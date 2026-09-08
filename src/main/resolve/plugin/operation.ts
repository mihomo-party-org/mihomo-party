// 统一网络操作模型（§0.4）：每个业务动作（discovery / enroll / fetchConfig / revoke）是一个 op，
// 拥有唯一的预算（deadline + AbortSignal）、唯一的路由执行器（RoutedRequester）与唯一的持久化出口
// （commit）。op 内不写 plugin.yaml / vault，只 stage 元数据；runOperation 在成功与失败两条路径
// 都快照 stage，因此失败也不丢元数据。
import { getPluginItem } from '../../config/plugin'
import { KeyedWriteQueue } from '../../utils/safeFile'
import { CPX_GUARD_REFUSED, GatewayError, codeOf, statusOf } from './errors'
import { requestOnce, type PluginRequestOptions, type PluginResponse } from './http-client'
import { createGuardedLookup, type ResolveAll } from './net-guard'
import {
  abortable,
  baseRouteOf,
  createRouteProvider,
  isFailoverError,
  preflightGuard,
  type BaseRoute,
  type RouteKey,
  type RouteProvider
} from './route'
import { readVault, type VaultReadResult } from './vault'

export type RetryPolicy = 'safe' | 'pre-send-only'

export const DEFAULT_BUDGET_MS = 120_000
const DEFAULT_TIMEOUT_MS = 30_000
// §1.2：该 origin 尚未固定路由时，每个候选的探测超时上限
const PROBE_TIMEOUT_MS = 10_000
const MIN_REMAINING_MS = 1000
// 提交预留：网络阶段在总 deadline 之前这么久结束，留给唯一的 commit（vault / plugin.yaml / profile 写入）。
// 一个 op 一个 deadline、一个 AbortSignal（§0.4 规则 1）：signal 在 budgetMs 处中止；网络阶段的每个等待
// （HTTP 超时、DNS 预检、代理配置读取）都按 networkRemainingMs 限时，因此网络阶段在 deadline 前 reserve
// 就结束，commit 接收同一个 signal 时它仍然有效（§0.4 规则 3“成功失败都提交”）。
export const COMMIT_RESERVE_MS = 10_000

export interface OperationBudget {
  // 唯一的 signal：HTTP、锁等待、DNS 预检、代理配置读取与 commit 内的 vault 锁等待都接收它；在 budgetMs 处中止
  readonly signal: AbortSignal
  // 距总 deadline 的余量
  remainingMs(): number
  // 距网络阶段结束点（budgetMs − reserve）的余量：ensureBudget 与每个网络等待的限时都按它计算
  networkRemainingMs(): number
  dispose(): void
}

// 单调时钟：系统时钟回拨不延长预算。
export function createBudget(
  budgetMs: number,
  now: () => number = () => performance.now()
): OperationBudget {
  const start = now()
  const reserve = Math.min(COMMIT_RESERVE_MS, Math.floor(budgetMs / 8))
  const networkMs = budgetMs - reserve
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(new Error('budget exhausted')), budgetMs)
  timer.unref?.()
  return {
    signal: ac.signal,
    remainingMs: () => Math.max(0, budgetMs - (now() - start)),
    networkRemainingMs: () => Math.max(0, networkMs - (now() - start)),
    dispose: () => clearTimeout(timer)
  }
}

export type RoutedRequestOptions = Omit<
  PluginRequestOptions,
  'proxy' | 'timeout' | 'lookup' | 'signal'
>

export interface RoutedRequester {
  request(url: string, opts: RoutedRequestOptions): Promise<PluginResponse>
}

export interface StagedMeta {
  gatewayState?: IPluginVault['gateway']
  itemPatch?: Partial<IPluginItem>
  // §5：本 op 拿到的签名候选（X-CPX-Discovery）；commit 用它整体替换 gateways / endpoints
  signedCandidate?: IDiscoveryCandidate
  // §5.3：该候选是否为同 seq 对齐（幂等重放）。只有对齐且列表 / 端点未变时 commit 才保留 lastGood
  signedAlign?: boolean
}

export interface OperationContext {
  readonly signal: AbortSignal
  remainingMs(): number
  readonly requester: RoutedRequester
  stage(meta: StagedMeta): void
}

export interface OperationInput {
  item: IPluginItem
  vault?: IPluginVault
  app: IAppConfig
  retryPolicy: RetryPolicy
  budgetMs?: number
  initialRoute?: BaseRoute
  routeProvider?: RouteProvider
  // runPluginOperation 先于 plugin lock 创建预算，再交给 runOperation 共用同一个 deadline。
  budget?: OperationBudget
  // 测试注入：guarded lookup 与 §1.4 预检共用的解析器
  resolveAll?: ResolveAll
}

export interface OperationMeta {
  selectedRoute?: BaseRoute
  gatewayState?: IPluginVault['gateway']
  itemPatch?: Partial<IPluginItem>
  signedCandidate?: IDiscoveryCandidate
  signedAlign?: boolean
}

export type OperationResult<T> =
  ({ ok: true; value: T } & OperationMeta) | ({ ok: false; error: unknown } & OperationMeta)

export class PluginNotFoundError extends Error {
  constructor() {
    super('Plugin not found')
    this.name = 'PluginNotFoundError'
  }
}

// plugin lock（§0.5）：按插件 id 串行化业务操作。只由 runPluginOperation 与删除入口在最外层
// 获取一次；锁不可重入，内部一律使用 *Unlocked 原语。删除先置 tombstone，排队中的后续操作
// 拿到锁时看到即放弃。
const pluginLocks = new KeyedWriteQueue()
const removedPlugins = new Set<string>()

export function withPluginLock<T>(
  id: string,
  task: () => Promise<T>,
  signal?: AbortSignal
): Promise<T> {
  return pluginLocks.run(id, task, signal)
}

export function markPluginRemoved(id: string): void {
  removedPlugins.add(id)
}

export function isPluginRemoved(id: string): boolean {
  return removedPlugins.has(id)
}

function stripBrackets(hostname: string): string {
  return hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname
}

// 路由执行器（§1）。粘性按 URL.origin 分作用域：同一 origin 第一次收到任意 HTTP 响应后固定路由；
// 换网关 / 换发现源 = 换 origin = 自动重新选择。未固定前逐个候选尝试，只对 failover-class 错误换路。
class Requester implements RoutedRequester {
  private readonly sticky = new Map<string, RouteKey>()
  private readonly preflights = new Map<string, Promise<void>>()
  private lastResponded: RouteKey | undefined

  constructor(
    private readonly provider: RouteProvider,
    private readonly budget: OperationBudget,
    private readonly timeoutMs: number,
    private readonly policy: RetryPolicy,
    private readonly resolveAll?: ResolveAll
  ) {}

  async request(url: string, opts: RoutedRequestOptions): Promise<PluginResponse> {
    const u = new URL(url)
    const origin = u.origin
    const fixed = this.sticky.get(origin)
    if (fixed) return this.send(url, opts, fixed, false)

    const keys = await this.provider.candidates()
    const probing = keys.length > 1
    let lastError: unknown
    for (const key of keys) {
      try {
        // 预算检查先于预检：剩余不足时以 budget exhausted 终态结束，而不是让预检的中止被当作可回退超时
        this.ensureBudget()
        if (key !== 'direct' && this.provider.guardNonDirect) {
          await this.preflight(origin, stripBrackets(u.hostname))
        }
        const res = await this.send(url, opts, key, probing)
        this.sticky.set(origin, key)
        this.lastResponded = key
        return res
      } catch (e) {
        // 已收到 HTTP 响应头（body 阶段才失败）：服务器已到达，固定路由并结束，不换路（§1.3）
        if (statusOf(e) !== undefined) {
          this.sticky.set(origin, key)
          this.lastResponded = key
          throw e
        }
        // blocked 终态：不再试任何路由；非 failover-class：直接结束（不固定路由）
        if (codeOf(e) === CPX_GUARD_REFUSED || !isFailoverError(e, this.policy)) throw e
        lastError = e
      }
    }
    throw lastError ?? new GatewayError('unreachable', 'no route available')
  }

  // 每个 origin 只预检一次；预检等待按网络余量限时（§0.4 规则 1）
  private preflight(origin: string, hostname: string): Promise<void> {
    let p = this.preflights.get(origin)
    if (!p) {
      p = preflightGuard(
        hostname,
        this.resolveAll,
        this.budget.signal,
        this.budget.networkRemainingMs()
      )
      this.preflights.set(origin, p)
    }
    return p
  }

  private ensureBudget(): number {
    const remaining = this.budget.networkRemainingMs()
    if (remaining < MIN_REMAINING_MS) throw new GatewayError('transient', 'budget exhausted')
    return remaining
  }

  private async send(
    url: string,
    opts: RoutedRequestOptions,
    key: RouteKey,
    probing: boolean
  ): Promise<PluginResponse> {
    const before = this.ensureBudget()
    // 代理配置读取也是 op 内的等待：接收同一个 signal 并按网络余量限时，等待之后再按最新余量重算（§0.4 规则 1）
    const proxy = await abortable(this.provider.proxyFor(key), this.budget.signal, before)
    const remaining = this.ensureBudget()
    const timeout = probing
      ? Math.min(this.timeoutMs, PROBE_TIMEOUT_MS, remaining)
      : Math.min(this.timeoutMs, remaining)
    const res = await requestOnce(url, {
      ...opts,
      timeout,
      signal: this.budget.signal,
      proxy,
      // 代理模式：目标由代理解析，本地 SSRF guarded lookup 不再适用（安全保证降级）
      lookup: proxy ? undefined : createGuardedLookup(this.resolveAll)
    })
    this.lastResponded = key
    return res
  }

  selectedRoute(): BaseRoute | undefined {
    return this.lastResponded ? baseRouteOf(this.lastResponded) : undefined
  }
}

// 网络执行层：创建 ctx → 执行 → finally dispose → 快照 stage → 返回。
export async function runOperation<T>(
  input: OperationInput,
  fn: (ctx: OperationContext) => Promise<T>
): Promise<OperationResult<T>> {
  const ownBudget = !input.budget
  const budget = input.budget ?? createBudget(input.budgetMs ?? DEFAULT_BUDGET_MS)
  const provider =
    input.routeProvider ?? createRouteProvider(input.item, input.app, input.initialRoute)
  const requester = new Requester(
    provider,
    budget,
    input.app.subscriptionTimeout ?? DEFAULT_TIMEOUT_MS,
    input.retryPolicy,
    input.resolveAll
  )
  const staged: StagedMeta = {}
  const ctx: OperationContext = {
    signal: budget.signal,
    remainingMs: () => budget.networkRemainingMs(),
    requester,
    stage(meta) {
      if (meta.gatewayState) staged.gatewayState = meta.gatewayState
      if (meta.itemPatch) staged.itemPatch = { ...staged.itemPatch, ...meta.itemPatch }
      if (meta.signedCandidate) {
        staged.signedCandidate = meta.signedCandidate
        staged.signedAlign = meta.signedAlign === true
      }
    }
  }

  let outcome: { ok: true; value: T } | { ok: false; error: unknown }
  try {
    outcome = { ok: true, value: await fn(ctx) }
  } catch (error) {
    outcome = { ok: false, error }
  } finally {
    try {
      await provider.dispose(budget.signal.aborted)
    } catch {
      // dispose 是 best-effort 清理，不覆盖业务结果
    }
    if (ownBudget) budget.dispose()
  }

  const meta: OperationMeta = { selectedRoute: requester.selectedRoute() }
  if (staged.gatewayState) meta.gatewayState = staged.gatewayState
  if (staged.itemPatch) meta.itemPatch = staged.itemPatch
  if (staged.signedCandidate) {
    meta.signedCandidate = staged.signedCandidate
    meta.signedAlign = staged.signedAlign === true
  }
  return { ...outcome, ...meta }
}

export type PluginOperationInput = Omit<OperationInput, 'item' | 'vault' | 'budget'>

// 外层：deadline 与 AbortController 先于一切创建；读取 item / vault、网络执行、最终提交都在
// 同一个 deadline 内。index.ts 的所有业务入口只用这个。
export async function runPluginOperation<T>(
  id: string,
  input: PluginOperationInput,
  fn: (ctx: OperationContext, item: IPluginItem, vault: VaultReadResult) => Promise<T>,
  commit: (result: OperationResult<T>, item: IPluginItem, signal: AbortSignal) => Promise<void>
): Promise<OperationResult<T>> {
  const budget = createBudget(input.budgetMs ?? DEFAULT_BUDGET_MS)
  try {
    return await withPluginLock(
      id,
      async () => {
        if (isPluginRemoved(id)) throw new PluginNotFoundError()
        const item = await getPluginItem(id)
        if (!item) throw new PluginNotFoundError()
        const vaultResult = await readVault(id, budget.signal)
        const vault = vaultResult.kind === 'ok' ? vaultResult.vault : undefined
        const result = await runOperation({ ...input, item, vault, budget }, (ctx) =>
          fn(ctx, item, vaultResult)
        )
        // 删除已排队（tombstone）时放弃提交：不写 plugin.yaml、不写 vault，避免删除中复活。
        if (isPluginRemoved(id)) return result
        // 提交接收同一个 signal：网络阶段按 networkRemainingMs 限时，在 deadline 前 reserve 就结束，
        // 因此 commit 运行时 signal 仍然有效
        await commit(result, item, budget.signal)
        return result
      },
      budget.signal
    )
  } finally {
    budget.dispose()
  }
}
