import { randomUUID } from 'crypto'
import {
  getPluginItem,
  addPluginItem,
  removePluginItem,
  patchPluginItem as patchConfig,
  pluginSchedule,
  DEFAULT_PLUGIN_INTERVAL_MIN
} from '../../config/plugin'
import {
  upsertPluginProfile,
  removePluginProfileContent,
  isPluginProfileInvalidError,
  syncPluginProfileSchedule
} from '../../config/profile'
import { getAppConfig } from '../../config/app'
import { mainWindow } from '../../window'
import { parseDescriptor } from './descriptor'
import { discoverGateway, originOf } from './discovery'
import { checkSeq, parseSigned } from './discovery-sig'
import { CPX_GUARD_REFUSED, codeOf } from './errors'
import { warnLog } from './log'
import { browserLogin, CLIENT_ID } from './oauth'
import { generateDevice, type DeviceKeys } from './device'
import { enroll, fetchConfig, revoke, GatewayError, type GatewayTarget } from './gateway'
import { effectiveRouteMode, isBaseRoute, isRouteMode, type BaseRoute } from './route'
import { normalizeEndpointPath } from './gateway-url'
import {
  readVault,
  writeVault,
  updateVault,
  removeVault,
  removeVaultIfDevice,
  hasVaultMaterial,
  ensureVaultWritable,
  VaultUnavailableError
} from './vault'
import { computeBackoff } from './backoff'
import { MAX_PLUGIN_FILE_BYTES } from './constants'
import { fetchRemotePlugin } from './remote'
import {
  runOperation,
  runPluginOperation,
  withPluginLock,
  markPluginRemoved,
  isPluginRemoved,
  createBudget,
  DEFAULT_BUDGET_MS,
  PluginNotFoundError,
  type OperationBudget,
  type OperationContext,
  type OperationResult,
  type RetryPolicy
} from './operation'

function notifyRenderer(): void {
  mainWindow?.webContents.send('pluginConfigUpdated')
  mainWindow?.webContents.send('profileConfigUpdated')
}

function readDescriptor(fileBytesB64: string): IPluginDescriptor {
  if (Buffer.byteLength(fileBytesB64, 'base64') > MAX_PLUGIN_FILE_BYTES) {
    throw new Error('Plugin file too large')
  }
  const text = Buffer.from(fileBytesB64, 'base64').toString('utf-8')
  return parseDescriptor(text)
}

// 预览：仅解析 + 校验，返回安装确认页展示子集。不建记录、不落盘、不联网。
export async function previewPlugin(fileBytesB64: string): Promise<IPluginDescriptorPreview> {
  const d = readDescriptor(fileBytesB64)
  return {
    name: d.provider.name,
    icon: d.provider.icon,
    site: d.provider.site,
    loginUrl: d.loginUrl,
    spec: d.spec,
    ...(d.discoveryUrls ? { discoveryHosts: d.discoveryUrls.map((u) => new URL(u).host) } : {}),
    ...(d.provider.description ? { description: d.provider.description } : {})
  }
}

// 安装：解析 + 建 needs-login 记录（无 profileId、不联网）
export async function installPlugin(fileBytesB64: string): Promise<IPluginItem> {
  const d = readDescriptor(fileBytesB64)
  const { pluginUseProxy = false } = await getAppConfig()
  const now = Date.now()
  const record: IPluginItem = {
    id: randomUUID(),
    name: d.provider.name,
    icon: d.provider.icon,
    site: d.provider.site,
    loginUrl: d.loginUrl,
    spec: d.spec,
    ...(d.discoveryUrls ? { discoveryUrls: d.discoveryUrls } : {}),
    ...(d.provider.description ? { description: d.provider.description } : {}),
    ...(d.providerPubKey ? { providerPubKey: d.providerPubKey } : {}),
    status: 'needs-login',
    interval: DEFAULT_PLUGIN_INTERVAL_MIN,
    autoUpdate: true,
    // 全局 pluginUseProxy 语义为“新装插件默认模式”：true → proxy，false → auto；镜像写 useProxy
    routeMode: pluginUseProxy ? 'proxy' : 'auto',
    useProxy: pluginUseProxy,
    created: now,
    updated: now
  }
  await addPluginItem(record)
  notifyRenderer()
  return record
}

export async function installRemotePlugin(url: string): Promise<IPluginItem> {
  return installPlugin(await fetchRemotePlugin(url))
}

// ---- 提交出口（§0.4 规则 3）：一个 op 一次持久化，成功失败都先提交元数据 ----

// 先经 updateVault 提交 gatewayState（如有且 vault 存在），返回待并入 plugin.yaml 的元数据 patch：
// selectedRoute → lastGoodRoute（仅 auto 模式）、itemPatch。
// vaultExtra：调用方需要在同一次 vault 写入里附带的其它修改（如剪除已回收的旧设备）——先 vault 后 plugin.yaml
// 的提交顺序不变，且不会出现"元数据已提交、vault 的另一半没写"的半截状态
async function commitMeta(
  id: string,
  item: IPluginItem,
  app: IAppConfig,
  result: OperationResult<unknown>,
  signal?: AbortSignal,
  vaultExtra?: (v: IPluginVault) => IPluginVault
): Promise<Partial<IPluginItem>> {
  if (result.gatewayState || result.signedCandidate || vaultExtra) {
    const staged = result.gatewayState
    const cand = result.signedCandidate
    const align = result.signedAlign === true
    await updateVault(
      id,
      (v) => {
        let next = staged ?? v.gateway
        if (cand) next = mergeSignedCandidate(next, cand, align)
        const withGateway = sameGatewayState(v.gateway, next) ? v : { ...v, gateway: next }
        return vaultExtra ? vaultExtra(withGateway) : withGateway
      },
      signal
    )
  }
  return {
    ...(result.itemPatch ?? {}),
    ...routePatch(item, app, result),
    ...messagePatch(item, result)
  }
}

// §4.2：op 失败 → 写 lastProviderMessage（如机场给了 message）；op 成功 → 清空。
function messagePatch(item: IPluginItem, result: OperationResult<unknown>): Partial<IPluginItem> {
  if (result.ok) return item.lastProviderMessage ? { lastProviderMessage: undefined } : {}
  const message = result.error instanceof GatewayError ? result.error.providerMessage : undefined
  if (message === item.lastProviderMessage) return {}
  return { lastProviderMessage: message }
}

// selectedRoute → lastGoodRoute（仅 auto 模式且有变化）
function routePatch(
  item: IPluginItem,
  app: IAppConfig,
  result: OperationResult<unknown>
): Partial<IPluginItem> {
  if (
    effectiveRouteMode(item, app) === 'auto' &&
    result.selectedRoute &&
    result.selectedRoute !== item.lastGoodRoute
  ) {
    return { lastGoodRoute: result.selectedRoute }
  }
  return {}
}

// §4.2：由 commit 按错误推导的客户端原因枚举，不含 host / IP。
function errorReasonOf(e: unknown): NonNullable<IPluginItem['lastUpdateErrorReason']> {
  // 发现阶段被 guard 拒绝的底层错误没有经过 gateway.ts 的映射，按 code 直接归为 blocked
  if (codeOf(e) === CPX_GUARD_REFUSED) return 'blocked'
  if (e instanceof GatewayError) {
    if (e.kind === 'blocked') return 'blocked'
    return e.status === undefined ? 'network' : 'server'
  }
  const status = (e as { status?: unknown } | null)?.status
  return typeof status === 'number' ? 'server' : 'network'
}

// 订阅内容没过核心校验时的原因：op 预算已耗尽（校验被中止或中止后拒绝落盘）按 network，核心拒绝内容按 server
function validationFailureReason(
  signal?: AbortSignal
): NonNullable<IPluginItem['lastUpdateErrorReason']> {
  return signal?.aborted ? 'network' : 'server'
}

// 连续 op 之间传递上一个 op 的成功路由作为首选（§0.4 规则 4）
function nextInitialRoute(result: OperationResult<unknown>): BaseRoute | undefined {
  return isBaseRoute(result.selectedRoute) ? result.selectedRoute : undefined
}

async function patchItem(id: string, patch: Partial<IPluginItem>): Promise<void> {
  if (Object.keys(patch).length === 0) return
  await patchConfig(id, patch)
}

function transientFailurePatch(
  record: IPluginItem,
  reason?: IPluginItem['lastUpdateErrorReason']
): Partial<IPluginItem> {
  const now = Date.now()
  const failureCount = (record.failureCount ?? 0) + 1
  const { nextRetryAt } = computeBackoff(failureCount, now)
  return {
    lastUpdateErrorType: 'transient',
    lastUpdateErrorAt: now,
    lastUpdateErrorReason: reason,
    failureCount,
    nextRetryAt
  }
}

function activePatch(): Partial<IPluginItem> {
  return {
    status: 'active',
    updated: Date.now(),
    failureCount: 0,
    lastUpdateErrorType: undefined,
    lastUpdateErrorAt: undefined,
    lastUpdateErrorReason: undefined,
    nextRetryAt: undefined
  }
}

function reauthPatch(): Partial<IPluginItem> {
  return { status: 'needs-reauth', updated: Date.now(), nextRetryAt: undefined }
}

// 写订阅 profile + 回填 profileId + 置 active + 清失败状态（首次登录与复用设备登录共用）
async function finishLogin(
  id: string,
  record: IPluginItem,
  content: string,
  meta: Partial<IPluginItem>,
  signal?: AbortSignal
): Promise<void> {
  const profileId = record.profileId ?? randomUUID()
  // 先把关联写入记录，再创建 profile：若创建成功后关联写入失败，下次登录会生成新 id 并留下含订阅内容的
  // 孤儿 profile；反过来一个悬空的 profileId 由下一次拉取时 upsertPluginProfile 补建，能自愈
  if (!record.profileId) await patchItem(id, { profileId })
  try {
    await upsertPluginProfile({ profileId, pluginId: id, name: record.name }, content, signal)
  } catch (e) {
    // 订阅内容没过核心校验（BL-002）：按瞬时失败记录（reason=server；预算耗尽则 network）并退避，
    // 不写 profile；登录以 NETWORK 类失败结束，设备与 vault 已持久化，下次登录走孤儿分支复用
    if (!isPluginProfileInvalidError(e)) throw e
    void warnLog('plugin subscription rejected by core validation', e)
    await patchItem(id, {
      ...meta,
      ...transientFailurePatch(record, validationFailureReason(signal)),
      profileId
    })
    notifyRenderer()
    throw new GatewayError('transient', 'subscription rejected by core validation')
  }
  await patchItem(id, { ...meta, ...activePatch(), profileId })
  notifyRenderer()
}

// 把登录过程中的底层错误映射为脱敏类别，避免网关 host / DNS / TLS 细节经 IPC 泄露到 renderer（spec §8/§13）。
function sanitizeLoginError(e: unknown): Error {
  if (e instanceof GatewayError) {
    return new Error(e.kind === 'revoked' ? 'PLUGIN_LOGIN_REVOKED' : 'PLUGIN_LOGIN_NETWORK')
  }
  return new Error('PLUGIN_LOGIN_FAILED')
}

// 同一插件同一时刻只允许一个登录流程（浏览器等待不在任何 op / 锁内，靠这个标记防止并发双登录）。
const loginsInFlight = new Set<string>()

// 登录（首次登录与重新认证同一入口）。对外抛错经 sanitizeLoginError 脱敏。
export async function loginPlugin(id: string): Promise<void> {
  if (loginsInFlight.has(id)) throw new Error('PLUGIN_LOGIN_FAILED')
  loginsInFlight.add(id)
  try {
    await runLogin(id)
  } catch (e) {
    throw sanitizeLoginError(e)
  } finally {
    loginsInFlight.delete(id)
  }
}

type OrphanOutcome = { kind: 'fresh' } | { kind: 'revoked' } | { kind: 'fetched'; yaml: string }

// 设备复用仅限「needs-login 且已有 vault」这一种情形：上次 enroll 成功但首份订阅拉取失败留下的
// “孤儿设备”，重拉即可，避免每次重试都 enroll 新设备、消耗服务端设备数上限。
// 其它情形——needs-reauth（显式重新登录）、active（刷新）、无 vault（首装/换机/Linux 无 safeStorage）——
// 一律走全新浏览器登录 + 新设备，与 spec §9「reauth = 再走一次 login 流程、新设备密钥」一致。
// 新设备登录流程 = discovery op → 浏览器（不在任何 op 内）→ enroll op → 创建 vault → fetchConfig op。
async function runLogin(id: string): Promise<void> {
  const app = await getAppConfig()

  const orphan = await runPluginOperation<OrphanOutcome>(
    id,
    { app, retryPolicy: 'safe' },
    async (ctx, item, vault) => {
      if (vault.kind === 'unavailable') throw new VaultUnavailableError()
      if (vault.kind !== 'ok' || item.status !== 'needs-login') return { kind: 'fresh' }
      try {
        return { kind: 'fetched', yaml: await fetchWithRecovery(ctx, item, vault.vault) }
      } catch (e) {
        // 孤儿设备已被吊销 → 丢弃旧 vault，落到下面的全新浏览器登录 + 新设备
        if (e instanceof GatewayError && e.kind === 'revoked') return { kind: 'revoked' }
        throw e
      }
    },
    async (result, item, signal) => {
      const meta = await commitMeta(id, item, app, result, signal)
      if (!result.ok) return patchItem(id, meta)
      if (result.value.kind === 'fetched') {
        return finishLogin(id, item, result.value.yaml, meta, signal)
      }
      await patchItem(id, meta)
      if (result.value.kind === 'revoked') await removeVault(id, signal)
    }
  )
  if (!orphan.ok) throw orphan.error
  // tombstone 只跳过 commit：删除已排队时不能把未提交的结果当成功继续
  if (isPluginRemoved(id)) throw new PluginNotFoundError()
  if (orphan.value.kind === 'fetched') return
  let initialRoute = nextInitialRoute(orphan)

  // 先确认 Keychain/secret store 可以实际加密，再打开 OAuth 和 enroll，避免用户完成
  // 浏览器登录后才发现私钥无法持久化。旧 Electron 兼容包会在这里走同步探测。
  await ensureVaultWritable()

  const discovered = await runPluginOperation<{ state: IPluginGatewayState; loginUrl: string }>(
    id,
    { app, retryPolicy: 'safe', initialRoute },
    async (ctx, item, vault) => {
      const candidate = await discoverGateway(
        { sources: discoverySourcesOf(item), signer: signerOf(item) },
        ctx
      )
      // §5.3 / §5.4：seq / digest 与轮换后的公开字段（loginUrl / discoveryUrls）在打开浏览器前就
      // 持久化，浏览器取消或后续失败都不会打开回滚窗口；浏览器使用新的 loginUrl。
      // 已有 vault（重新登录）时网关状态也先同步进 vault，再推进 seq（§5.3 提交顺序）；无 vault 时
      // updateVault 是 no-op，首次安装仍走延后创建。
      const patch = candidatePatch(item, candidate)
      const align = candidate.seq !== undefined && candidate.seq === item.discoverySeq
      const state =
        vault.kind === 'ok'
          ? mergeSignedCandidate(vault.vault.gateway, candidate, align)
          : stateFromCandidate(candidate)
      ctx.stage({ gatewayState: state, itemPatch: patch })
      return { state, loginUrl: patch.loginUrl ?? item.loginUrl }
    },
    async (result, item, signal) => {
      const meta = await commitMeta(id, item, app, result, signal)
      await patchItem(id, meta)
      if (meta.loginUrl) notifyRenderer()
    }
  )
  if (!discovered.ok) throw discovered.error
  if (isPluginRemoved(id)) throw new PluginNotFoundError()
  const { state: discoveredState, loginUrl } = discovered.value
  initialRoute = nextInitialRoute(discovered) ?? initialRoute

  const dev = generateDevice()
  const oauth = await browserLogin(loginUrl)

  // enroll 消费一次性 code，不自动重放：pre-send-only（路由层与网关层同时生效）。
  // 提交模式 deferVaultCreate（§2.5）：成功时在同一次 plugin 临界区内先用内存密钥 + gatewayState 创建
  // vault，再 patch 非秘密元数据——不再释放锁后二次取锁，排队在中间的更新无法回滚刚提交的更高版本。
  // 从 enroll 成功到 vault 创建成功之间的任何异常（含 patch 失败）都在同一临界区内用内存密钥 best-effort
  // 回收设备，并只删除本次写入的 vault（按 deviceId 核对，替换失败时仍有效的旧设备 vault 保留）。
  // 已有 vault 的重新登录（§5.4）：起始网关状态取锁内最新的 vault，而不是浏览器等待前的快照——等待期间
  // 的并发更新可能已经推进 seq / 轮换网关。
  // 删除落在 enroll 在途时 commit 会被 tombstone 跳过、记录随后被移除：补偿 revoke 只能依赖 op 内保存的
  // 记录快照与内存中的密钥。
  let enrollItem: IPluginItem | undefined
  let enrollState: IPluginGatewayState = discoveredState
  // 重新登录时仍然有效的旧设备 vault：新 vault 已覆盖它而元数据提交失败时用来恢复（旧设备可继续使用、可被回收）
  let priorVault: IPluginVault | undefined
  const enrolled = await runPluginOperation<void>(
    id,
    { app, retryPolicy: 'pre-send-only', initialRoute },
    async (ctx, item, vault) => {
      enrollItem = item
      priorVault = vault.kind === 'ok' ? vault.vault : undefined
      enrollState = vault.kind === 'ok' ? vault.vault.gateway : discoveredState
      ctx.stage({ gatewayState: enrollState })
      return withGatewayRecovery(ctx, item, enrollState, 'pre-send-only', (target) =>
        enroll(
          target,
          {
            code: oauth.code,
            code_verifier: oauth.verifier,
            redirect_uri: oauth.redirectUri,
            client_id: CLIENT_ID,
            devicePubKey: dev.pubKeyB64,
            deviceId: dev.deviceId
          },
          ctx.requester
        )
      )
    },
    async (result, item, signal) => {
      // 失败：提交全部非秘密元数据（重发现 stage 的 seq/digest/公开字段、成功路由、机场 message）；
      // 已有 vault 时 gatewayState 先经 commitMeta 同步进 vault（§5.3 提交顺序），无 vault 时为 no-op
      if (!result.ok) {
        // 结果不确定的失败（请求可能已到达服务端：possibly-sent 的网络错误、任何 HTTP 响应）：设备可能已被
        // 创建，用内存密钥 best-effort 回收，避免服务端留下客户端无法再管理的设备并耗尽设备额度
        // （revoke 对不存在的设备幂等，spec §10）。pre-send 失败与 blocked / revoked 不可能创建设备。
        // 元数据提交本身抛错时补偿也必须执行（finally）。
        try {
          await patchItem(id, await commitMeta(id, item, app, result, signal))
        } finally {
          if (mayHaveEnrolled(result.error)) {
            await compensateEnroll(item, app, result.gatewayState ?? enrollState, dev)
          }
        }
        return
      }
      const gatewayState = result.gatewayState ?? enrollState
      try {
        await writeVault(
          id,
          {
            devicePrivKey: dev.privKeyB64,
            deviceId: dev.deviceId,
            gateway: gatewayState,
            ...staleDevicesAfterReplace(priorVault, dev.deviceId)
          },
          signal
        )
        await patchItem(id, {
          ...(result.itemPatch ?? {}),
          ...routePatch(item, app, result),
          ...messagePatch(item, result),
          // 新设备已持久化：needs-reauth 转为 needs-login，若随后的首次拉取失败，下次登录走孤儿设备复用分支
          // （§2.5 步骤 1）而不是再 enroll 一台设备；active 保持不变（定时更新直接使用新 vault）
          ...(item.status === 'needs-reauth' ? { status: 'needs-login' as const } : {})
        })
      } catch (error) {
        await compensateEnroll(item, app, gatewayState, dev, priorVault)
        throw error
      }
    }
  )
  if (isPluginRemoved(id)) {
    // commit 被 tombstone 跳过：enroll 成功（设备已在服务端创建但本地不会持久化）或结果不确定时，
    // 都用快照 + 内存密钥回收（与删除串行）
    if (enrollItem && (enrolled.ok || mayHaveEnrolled(enrolled.error))) {
      const snapshot = enrollItem
      await withPluginLock(id, () =>
        compensateEnroll(snapshot, app, enrolled.gatewayState ?? enrollState, dev)
      )
    }
    if (!enrolled.ok) throw enrolled.error
    throw new PluginNotFoundError()
  }
  if (!enrolled.ok) throw enrolled.error
  initialRoute = nextInitialRoute(enrolled) ?? initialRoute

  const fetched = await runPluginOperation<string>(
    id,
    { app, retryPolicy: 'safe', initialRoute },
    async (ctx, item, vault) => {
      if (vault.kind !== 'ok') throw new Error('vault missing after enroll')
      return fetchWithRecovery(ctx, item, vault.vault)
    },
    async (result, item, signal) => {
      const meta = await commitMeta(id, item, app, result, signal)
      if (result.ok) return finishLogin(id, item, result.value, meta, signal)
      await patchItem(id, meta)
    }
  )
  if (!fetched.ok) throw fetched.error
  // 换了新设备：旧设备仍占着服务端额度，现在回收（失败留在 vault 里等下次拉取 / 删除）
  await retireStaleDevices(id, app)
}

// 重新登录换了新设备：旧设备仍在服务端占着额度，记入新 vault 的待回收列表。已在列表里的更旧设备一并保留，
// 同一设备不重复；新设备自身永不入列
function staleDevicesAfterReplace(
  prior: IPluginVault | undefined,
  newDeviceId: string
): Pick<IPluginVault, 'staleDevices'> {
  if (!prior) return {}
  const seen = new Set<string>([newDeviceId])
  const list: IPluginStaleDevice[] = []
  for (const d of [
    ...(prior.staleDevices ?? []),
    { deviceId: prior.deviceId, devicePrivKey: prior.devicePrivKey }
  ]) {
    if (seen.has(d.deviceId)) continue
    seen.add(d.deviceId)
    list.push(d)
  }
  return list.length > 0 ? { staleDevices: list } : {}
}

// 回收待回收的旧设备：独立的小预算 op（登录 / 拉取已经成功，不能让它拖住用户可见的流程）。
// 每个 op 只回收一台——多台共用一次 op 会让第二台沿用第一台重发现之前的网关状态；每台都从刚提交的 vault 出发。
// 回收成功（或服务端已不认识这台设备）就在同一次 vault 写入里剪掉它；失败留到下次。不抛。
const STALE_REVOKE_BUDGET_MS = 30_000
const MAX_STALE_RETIRED_PER_RUN = 5

async function retireStaleDevices(id: string, app: IAppConfig): Promise<void> {
  for (let i = 0; i < MAX_STALE_RETIRED_PER_RUN; i++) {
    if (!(await retireOneStaleDevice(id, app))) return
  }
}

function withoutStaleDevice(v: IPluginVault, deviceId: string): IPluginVault {
  const rest = (v.staleDevices ?? []).filter((d) => d.deviceId !== deviceId)
  if (rest.length === (v.staleDevices ?? []).length) return v
  return { ...v, staleDevices: rest.length > 0 ? rest : undefined }
}

// 返回"回收了一台且可能还有剩余"；无剩余 / 失败 / 插件已删除 → false
async function retireOneStaleDevice(id: string, app: IAppConfig): Promise<boolean> {
  let retired: string | undefined
  try {
    const r = await runPluginOperation<boolean>(
      id,
      { app, retryPolicy: 'safe', budgetMs: STALE_REVOKE_BUDGET_MS },
      async (ctx, item, vault) => {
        if (vault.kind !== 'ok') return false
        const target = vault.vault.staleDevices?.[0]
        if (!target) return false
        try {
          await withGatewayRecovery(ctx, item, vault.vault.gateway, 'safe', (t) =>
            revoke(
              t,
              { deviceId: target.deviceId, privKeyB64: target.devicePrivKey },
              ctx.requester
            )
          )
        } catch (e) {
          // 服务端已不认识这台设备（challenge 返回 device_revoked）：清理目标已达成，同样从列表移除
          if (!(e instanceof GatewayError && e.kind === 'revoked')) throw e
        }
        retired = target.deviceId
        return (vault.vault.staleDevices?.length ?? 0) > 1
      },
      async (result, item, signal) => {
        const done = retired
        const patch = await commitMeta(
          id,
          item,
          app,
          result,
          signal,
          done ? (v) => withoutStaleDevice(v, done) : undefined
        )
        await patchItem(id, patch)
      }
    )
    return r.ok && r.value
  } catch (e) {
    if (!(e instanceof PluginNotFoundError)) void warnLog('stale device retirement failed', e)
    return false
  }
}

// enroll 失败但服务端可能已处理请求：possibly-sent 的网络错误，或任何已收到的 HTTP 响应（有 status）。
// pre-send 失败、guard 拦截（blocked）与账号被吊销（revoked）都不可能创建设备；无 phase 无 status 的
// 内部错误（如预算耗尽）发生在请求之前，同样排除。
function mayHaveEnrolled(e: unknown): boolean {
  if (!(e instanceof GatewayError)) return false
  if (e.kind === 'blocked' || e.kind === 'revoked') return false
  return e.phase === 'possibly-sent' || e.status !== undefined
}

// 登录补偿（§2.5）：用仍在内存中的新密钥 best-effort 回收设备，避免用户重试登录不断消耗服务端设备额度；
// 只删除本次登录写入的 vault（deviceId 核对）。补偿也是一次业务操作：自建预算（op 的预算可能已耗尽），
// 在调用方已持有的 plugin 临界区内串行执行；vault 锁在 plugin 锁之下。失败不抛。
async function compensateEnroll(
  item: IPluginItem,
  app: IAppConfig,
  state: IPluginGatewayState,
  dev: DeviceKeys,
  restore?: IPluginVault
): Promise<void> {
  const budget = createBudget(DEFAULT_BUDGET_MS)
  let revoked = false
  try {
    revoked = await bestEffortRevokeWithKeys(item, app, state, dev, budget)
  } catch {
    // best-effort
  } finally {
    budget.dispose()
  }
  if (restore) {
    // 重新登录：恢复被新 vault 覆盖的旧设备 vault（若新 vault 从未写入，旧文件仍在，重写等价于无操作）。
    // 新设备没能回收时把它记进旧 vault 的待回收列表，交给之后的拉取 / 删除再试，而不是永久留在服务端
    const vault = revoked
      ? restore
      : {
          ...restore,
          ...staleDevicesAfterReplace(
            { ...restore, deviceId: dev.deviceId, devicePrivKey: dev.privKeyB64 },
            restore.deviceId
          )
        }
    await writeVault(item.id, vault).catch(() => {})
  } else {
    await removeVaultIfDevice(item.id, dev.deviceId).catch(() => {})
  }
}

// 用记录快照而不是重读 plugin.yaml：调用时记录可能已被排队的删除移除
async function bestEffortRevokeWithKeys(
  item: IPluginItem,
  app: IAppConfig,
  state: IPluginGatewayState,
  dev: DeviceKeys,
  budget?: OperationBudget
): Promise<boolean> {
  const cred = { deviceId: dev.deviceId, privKeyB64: dev.privKeyB64 }
  const r = await runOperation({ item, app, retryPolicy: 'safe', budget }, (ctx) =>
    withGatewayRecovery(ctx, item, state, 'safe', (target) => revoke(target, cred, ctx.requester))
  )
  // 服务端已不认识这台设备（revoked）同样算回收完成
  return r.ok || (r.error instanceof GatewayError && r.error.kind === 'revoked')
}

// best-effort 通知服务端解绑设备（调用方已持有 plugin lock）。网关轮换后旧 gateway 可能
// retired/unreachable：多网关切换 + 重新发现再 revoke，避免设备绑定残留。失败不抛。
async function revokePluginDeviceUnlocked(
  item: IPluginItem,
  vault: IPluginVault,
  app: IAppConfig,
  budget?: OperationBudget
): Promise<void> {
  const cred = { deviceId: vault.deviceId, privKeyB64: vault.devicePrivKey }
  await runOperation({ item, vault, app, retryPolicy: 'safe', budget }, (ctx) =>
    withGatewayRecovery(ctx, item, vault.gateway, 'safe', (target) =>
      revoke(target, cred, ctx.requester)
    )
  )
}

// 发现源（§0.3 / §3）：loginUrl 的 origin 始终是第一个，其后是 .cpx 的 discoveryUrls。
function discoverySourcesOf(item: IPluginItem): string[] {
  const login = originOf(item.loginUrl)
  return [login, ...(item.discoveryUrls ?? []).filter((u) => u !== login)]
}

function stateFromCandidate(c: IDiscoveryCandidate): IPluginGatewayState {
  return { gateway: c.gateways[0], gateways: c.gateways, endpoints: c.endpoints }
}

// §5：有 providerPubKey 的插件在发现时携带 signer；minSeq / currentDigest 来自 plugin.yaml
function signerOf(item: IPluginItem): DiscoverySigner | undefined {
  if (!item.providerPubKey) return undefined
  return {
    pubKeyB64: item.providerPubKey,
    minSeq: item.discoverySeq,
    currentDigest: item.discoveryDigest
  }
}

// seq 是提交标记：成对写入 plugin.yaml（vault 之后）
function seqPatch(c: IDiscoveryCandidate): Partial<IPluginItem> {
  if (c.seq === undefined || c.digest === undefined) return {}
  return { discoverySeq: c.seq, discoveryDigest: c.digest }
}

function sameStringList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

// §5.4 公开字段轮换：签名候选携带的 loginUrl / discoveryUrls 与 seq / digest 一起写入 plugin.yaml。
// discoveryUrls 缺失 = 不改；[] = 清空；非空时排除 loginUrl 的 origin。同 seq 对齐时幂等重放。
function candidatePatch(item: IPluginItem, c: IDiscoveryCandidate): Partial<IPluginItem> {
  const patch: Partial<IPluginItem> = seqPatch(c)
  if (c.seq === undefined) return patch
  const loginUrl = c.loginUrl ?? item.loginUrl
  if (c.loginUrl !== undefined && c.loginUrl !== item.loginUrl) patch.loginUrl = c.loginUrl
  if (c.discoveryUrls !== undefined) {
    const login = originOf(loginUrl)
    const next = c.discoveryUrls.filter((u) => u !== login)
    if (!sameStringList(item.discoveryUrls ?? [], next)) {
      patch.discoveryUrls = next.length ? next : undefined
    }
  }
  return patch
}

// §5.3 X-CPX-Discovery：只在该插件有 providerPubKey 时读取；任何校验失败只丢弃候选并 warn，
// 绝不撤销已认证成功的 config 响应。
async function consumeHeaderDiscovery(
  ctx: OperationContext,
  item: IPluginItem,
  header: string | undefined,
  accepted?: IDiscoveryCandidate
): Promise<void> {
  // 本 op 内重发现已接受过候选时，seq/digest 下限与公开字段的比较基线都以“应用该候选后的记录”为准：
  // 旧头不能倒退刚接受的轮换；后到的更高 seq 对 loginUrl/discoveryUrls 具备完整的覆盖语义
  const base: IPluginItem = accepted ? { ...item, ...candidatePatch(item, accepted) } : item
  const signer = signerOf(base)
  if (!signer || header === undefined) return
  try {
    const { payload, digest } = parseSigned(header, signer.pubKeyB64)
    const verdict = checkSeq(payload.seq, digest, signer)
    if (verdict === 'rollback' || verdict === 'equivocation') {
      void warnLog(`X-CPX-Discovery ignored: ${verdict} (seq ${payload.seq})`)
      return
    }
    const candidate: IDiscoveryCandidate = {
      gateways: payload.gateways,
      endpoints: payload.endpoints,
      seq: payload.seq,
      digest
    }
    if (payload.loginUrl !== undefined) candidate.loginUrl = payload.loginUrl
    if (payload.discoveryUrls !== undefined) candidate.discoveryUrls = payload.discoveryUrls
    ctx.stage({
      signedCandidate: candidate,
      signedAlign: verdict === 'align',
      itemPatch: candidatePatch(base, candidate)
    })
  } catch (e) {
    void warnLog('X-CPX-Discovery ignored: invalid envelope', e)
  }
}

// 合并优先级（§2.4）：先取 recovery 的 gatewayState；若本 op 还拿到了签名候选，用候选的
// gateways / endpoints 整体替换并清空 lastGood。只有同 seq 对齐（幂等重放）且列表与端点完全相同时
// 才保留 lastGood；更高 seq 即使列表相同也按“新文档”处理。
function mergeSignedCandidate(
  base: IPluginGatewayState,
  cand: IDiscoveryCandidate,
  align: boolean
): IPluginGatewayState {
  const unchanged =
    base.gateways.length === cand.gateways.length &&
    base.gateways.every((g, i) => g === cand.gateways[i]) &&
    base.endpoints.enroll === cand.endpoints.enroll &&
    base.endpoints.challenge === cand.endpoints.challenge &&
    base.endpoints.config === cand.endpoints.config &&
    base.endpoints.revoke === cand.endpoints.revoke
  const lastGood = align && unchanged ? base.lastGood : undefined
  const next: IPluginGatewayState = {
    gateway: lastGood ?? cand.gateways[0],
    gateways: cand.gateways,
    endpoints: cand.endpoints
  }
  if (lastGood) next.lastGood = lastGood
  return next
}

function withLastGood(state: IPluginGatewayState, gateway: string): IPluginGatewayState {
  return { ...state, gateway, lastGood: gateway }
}

// 候选顺序：[lastGood ?? gateways[0], …其余按原序]
function orderedGateways(state: IPluginGatewayState): string[] {
  const first =
    state.lastGood && state.gateways.includes(state.lastGood) ? state.lastGood : undefined
  if (!first) return [...state.gateways]
  return [first, ...state.gateways.filter((g) => g !== first)]
}

// 去重键：origin + 归一化 endpoints（签名模式再加 seq/digest）；同 origin 换 endpoints 或换版本视为新目标（§2.4）。
// 端点在解析时已归一化（discovery / discovery-sig / parseVault），这里再归一化一次是幂等的防御：
// 保证 "/a/../config" 与 "/config" 永远是同一个目标。JSON 元组编码避免分隔符与路径字符碰撞。
function targetKey(t: GatewayTarget, seq?: number, digest?: string): string {
  const e = t.endpoints
  return JSON.stringify([
    t.gateway,
    normalizeEndpointPath(e.enroll),
    normalizeEndpointPath(e.challenge),
    normalizeEndpointPath(e.config),
    normalizeEndpointPath(e.revoke),
    seq ?? null,
    digest ?? null
  ])
}

// §2.4 候选结果表：unreachable / 无 status 的 transient / retired → 下一个；其余停止抛出。
// pre-send-only 时“下一个”只对 phase === 'pre-send' 的 unreachable 成立。
function shouldTryNextGateway(e: unknown, policy: RetryPolicy): boolean {
  if (!(e instanceof GatewayError)) return false
  // 410 是 HTTP 响应：pre-send-only（enroll）下服务器已收到请求，不得换网关重放一次性 code
  if (e.kind === 'retired') return policy === 'safe'
  if (e.kind === 'unreachable') return policy === 'safe' || e.phase === 'pre-send'
  if (e.kind === 'transient' && e.status === undefined) return policy === 'safe'
  return false
}

function sameGatewayState(a: IPluginGatewayState, b: IPluginGatewayState): boolean {
  return (
    a.gateway === b.gateway &&
    a.lastGood === b.lastGood &&
    a.gateways.length === b.gateways.length &&
    a.gateways.every((g, i) => g === b.gateways[i]) &&
    a.endpoints.enroll === b.endpoints.enroll &&
    a.endpoints.challenge === b.endpoints.challenge &&
    a.endpoints.config === b.endpoints.config &&
    a.endpoints.revoke === b.endpoints.revoke
  )
}

// 多网关切换 + 一次重发现（§2.4）。op 是完整业务动作（如 challenge + config），保证 nonce 与网关一致。
// 逐个候选执行；全部以“下一个”类失败结束 → 用 sources 重发现一次，新列表排除本 op 已尝试过的目标；
// 仍失败 → unreachable('all gateways failed')。gatewayState 一律经 ctx.stage() 上交：每次列表变化、
// 每次成功都 stage，失败时 throw 前已 stage。拉订阅、enroll 与 revoke 共用。
async function withGatewayRecovery<T>(
  ctx: OperationContext,
  item: IPluginItem,
  state: IPluginGatewayState,
  policy: RetryPolicy,
  op: (target: GatewayTarget) => Promise<T>,
  onRediscovered?: (candidate: IDiscoveryCandidate) => void
): Promise<T> {
  const sources = discoverySourcesOf(item)
  const signer = signerOf(item)
  const tried = new Set<string>()
  // 最后一个“可切换”的网关错误：它可能携带机场 message（如 retired 的说明），终态错误要保留它
  let lastSwitchable: GatewayError | undefined
  const attempt = async (
    list: IPluginGatewayState,
    seq: number | undefined,
    digest: string | undefined
  ): Promise<{ done: true; value: T } | null> => {
    for (const gateway of orderedGateways(list)) {
      const target: GatewayTarget = { gateway, endpoints: list.endpoints }
      const key = targetKey(target, seq, digest)
      if (tried.has(key)) continue
      tried.add(key)
      try {
        const value = await op(target)
        ctx.stage({ gatewayState: withLastGood(list, gateway) })
        return { done: true, value }
      } catch (e) {
        if (!shouldTryNextGateway(e, policy)) throw e
        // 后一个可切换错误没有机场 message 时继承前一个的（多网关：retired 带说明、下一个只是不可达）
        lastSwitchable = carryProviderMessage(e as GatewayError, lastSwitchable)
      }
    }
    return null
  }

  const first = await attempt(
    state,
    signer ? item.discoverySeq : undefined,
    signer ? item.discoveryDigest : undefined
  )
  if (first) return first.value

  let candidate: IDiscoveryCandidate
  try {
    candidate = await discoverGateway({ sources, signer }, ctx)
  } catch (e) {
    throw rediscoveryFailure(e, lastSwitchable)
  }
  const rediscovered = stateFromCandidate(candidate)
  ctx.stage({ gatewayState: rediscovered, itemPatch: candidatePatch(item, candidate) })
  onRediscovered?.(candidate)
  const second = await attempt(rediscovered, candidate.seq, candidate.digest)
  if (second) return second.value
  throw carryProviderMessage(new GatewayError('unreachable', 'all gateways failed'), lastSwitchable)
}

function carryProviderMessage(err: GatewayError, from: GatewayError | undefined): GatewayError {
  if (!err.providerMessage && from?.providerMessage) err.providerMessage = from.providerMessage
  return err
}

// 重发现失败的终态（§2.4）：发现阶段的底层错误不是 GatewayError，统一规范化——guard 拒绝 → blocked，
// 其余 → unreachable；并保留最后一个可切换网关错误携带的机场 message。
function rediscoveryFailure(e: unknown, last: GatewayError | undefined): GatewayError {
  // blocked 发生在发请求之前，revoked 是终态：都不携带早先网关的机场 message（§4.2）
  if (e instanceof GatewayError) {
    return e.kind === 'blocked' || e.kind === 'revoked' ? e : carryProviderMessage(e, last)
  }
  const detail = e instanceof Error ? e.message : String(e)
  if (codeOf(e) === CPX_GUARD_REFUSED) {
    return new GatewayError('blocked', `rediscovery failed: ${detail}`)
  }
  return carryProviderMessage(
    new GatewayError('unreachable', `rediscovery failed: ${detail}`),
    last
  )
}

async function fetchWithRecovery(
  ctx: OperationContext,
  item: IPluginItem,
  vault: IPluginVault
): Promise<string> {
  const cred = { deviceId: vault.deviceId, privKeyB64: vault.devicePrivKey }
  let accepted: IDiscoveryCandidate | undefined
  const { yaml, discovery } = await withGatewayRecovery(
    ctx,
    item,
    vault.gateway,
    'safe',
    (target) => fetchConfig(target, cred, ctx.requester),
    (candidate) => {
      accepted = candidate
    }
  )
  await consumeHeaderDiscovery(ctx, item, discovery, accepted)
  return yaml
}

type UpdateOutcome =
  | { kind: 'skipped' }
  | { kind: 'corrupt' }
  | { kind: 'vault-missing' }
  | { kind: 'vault-unavailable' }
  | { kind: 'fetched'; yaml: string }

// 自动/手动更新（静默，不弹浏览器）
export async function updatePluginProfile(id: string, force = false): Promise<void> {
  const app = await getAppConfig()
  let outcome: OperationResult<UpdateOutcome>
  // 订阅是否真的提交成功：核心校验失败被 commit 记为退避后 op 结果仍是 ok/fetched，不能拿它当依据
  let committed = false
  try {
    outcome = await runPluginOperation<UpdateOutcome>(
      id,
      { app, retryPolicy: 'safe' },
      async (ctx, item, vault) => {
        if (item.status === 'needs-login' || item.status === 'needs-reauth') {
          return { kind: 'skipped' }
        }
        // active/needs-reauth 态必须有 profileId（spec §10）。损坏/迁移异常导致 active 无 profileId 时，
        // 标 needs-reauth 而非用 undefined 拼出 profiles/undefined.yaml。
        if (!item.profileId) return { kind: 'corrupt' }
        // 非强制（定时器）触发时以插件记录的最新 autoUpdate 为准：关掉开关后残留的一次 tick 不再联网（BL-003）
        if (!force && item.autoUpdate === false) return { kind: 'skipped' }
        if (!force && item.nextRetryAt && Date.now() < item.nextRetryAt) return { kind: 'skipped' }
        if (vault.kind === 'unavailable') return { kind: 'vault-unavailable' }
        if (vault.kind !== 'ok') return { kind: 'vault-missing' }
        return { kind: 'fetched', yaml: await fetchWithRecovery(ctx, item, vault.vault) }
      },
      async (result, item, signal) => {
        // 跳过的 op 没有发出任何请求：不提交、不清空机场消息、不通知
        if (result.ok && result.value.kind === 'skipped') return
        const meta = await commitMeta(id, item, app, result, signal)
        if (result.ok) {
          const outcome = result.value
          if (outcome.kind === 'corrupt' || outcome.kind === 'vault-missing' || !item.profileId) {
            await patchItem(id, { ...meta, ...reauthPatch() })
          } else if (outcome.kind === 'vault-unavailable') {
            await patchItem(id, { ...meta, ...transientFailurePatch(item) })
          } else if (outcome.kind === 'fetched') {
            try {
              await upsertPluginProfile(
                { profileId: item.profileId, pluginId: id, name: item.name },
                outcome.yaml,
                signal
              )
              await patchItem(id, { ...meta, ...activePatch() })
              committed = true
            } catch (e) {
              // 订阅内容没过核心校验（BL-002）：旧 profile 原样保留，按瞬时失败退避（server；预算耗尽则 network）
              if (!isPluginProfileInvalidError(e)) throw e
              void warnLog('plugin subscription rejected by core validation', e)
              await patchItem(id, {
                ...meta,
                ...transientFailurePatch(item, validationFailureReason(signal))
              })
            }
          }
        } else if (result.error instanceof GatewayError && result.error.kind === 'revoked') {
          await patchItem(id, {
            ...meta,
            status: 'needs-reauth',
            lastUpdateErrorType: 'auth',
            lastUpdateErrorAt: Date.now(),
            lastUpdateErrorReason: undefined,
            nextRetryAt: undefined
          })
        } else {
          // blocked（§1.4）与网络/服务端失败一样按 transient 退避，卡片按 reason 显示固定文案
          await patchItem(id, {
            ...meta,
            ...transientFailurePatch(item, errorReasonOf(result.error))
          })
        }
        notifyRenderer()
      }
    )
  } catch (e) {
    if (e instanceof PluginNotFoundError) return
    throw e
  }
  // 只有真正拉取并提交成功（不是跳过 / 退避 / 失败）才顺手回收上次没回收掉的旧设备（缓存命中，不解密）
  if (!outcome.ok || outcome.value.kind !== 'fetched' || !committed) return
  const vault = await readVault(id)
  if (vault.kind === 'ok' && (vault.vault.staleDevices?.length ?? 0) > 0) {
    await retireStaleDevices(id, app)
  }
}

// 启动审计只检查 vault 文件/内存是否存在，不触发 safeStorage/Keychain 解密。
// active 但材料缺失（如 Linux 内存兜底重启）→ needs-reauth。
export async function auditPluginVault(id: string): Promise<void> {
  const record = await getPluginItem(id)
  if (!record || record.status !== 'active') return
  if (hasVaultMaterial(id)) return
  await patchItem(id, reauthPatch())
  notifyRenderer()
}

// 删除临界区（§0.5）：tombstone → revoke → profile → item → vault，在同一个 plugin lock 内完成。
// 两个删除入口——插件管理 removePlugin 与 profiles 列表删除（profile.ts removeProfileItem 级联）——
// 都只在最外层取一次锁再调用这里。
async function removePluginLocked(
  id: string,
  profileId: string | undefined,
  budget: OperationBudget
): Promise<void> {
  const record = await getPluginItem(id)
  if (record) {
    const vaultResult = await readVault(id)
    if (vaultResult.kind === 'ok') {
      const app = await getAppConfig()
      // 待回收的旧设备也一并解绑（同一预算，best-effort），再解绑当前设备
      for (const d of vaultResult.vault.staleDevices ?? []) {
        await revokePluginDeviceUnlocked(
          record,
          { ...vaultResult.vault, deviceId: d.deviceId, devicePrivKey: d.devicePrivKey },
          app,
          budget
        )
      }
      await revokePluginDeviceUnlocked(record, vaultResult.vault, app, budget)
    }
  }
  // profile 在锁内删除：在途更新的 commit 已经被 tombstone 拦住，不会再把它重建出来。
  // profile 删除可能触发核心重启并抛错：本地清理仍必须完成——tombstone 已置，残留的 item / vault
  // 会变成每个操作都被拒绝、却仍显示在列表里的僵尸插件。错误在清理之后再抛出。
  const pid = profileId ?? record?.profileId
  let profileError: unknown
  let profileFailed = false
  if (pid) {
    try {
      await removePluginProfileContent(pid)
    } catch (e) {
      profileError = e
      profileFailed = true
    }
  }
  if (record) await removePluginItem(id)
  await removeVault(id)
  if (profileFailed) throw profileError
}

// 删除入口的唯一预算只约束网络（revoke，耗尽即跳过）；锁等待与本地清理必须完成，不接收 signal（§0.5）。
export async function removePlugin(id: string): Promise<void> {
  markPluginRemoved(id)
  const budget = createBudget(DEFAULT_BUDGET_MS)
  try {
    await withPluginLock(id, () => removePluginLocked(id, undefined, budget))
  } finally {
    budget.dispose()
  }
  notifyRenderer()
}

// profiles 列表删除的级联入口：profile.ts 只做判定，记录、文件与插件侧都在这里的临界区内删除。
export async function removePluginForProfile(id: string, profileId: string): Promise<void> {
  markPluginRemoved(id)
  const budget = createBudget(DEFAULT_BUDGET_MS)
  try {
    await withPluginLock(id, () => removePluginLocked(id, profileId, budget))
  } finally {
    budget.dispose()
  }
}

// 渲染层可编辑的字段白名单（IPC 边界）：信任根（providerPubKey）、发现标记（seq/digest）、loginUrl /
// discoveryUrls、状态与身份字段只能由主进程业务逻辑写入。
const EDITABLE_PLUGIN_FIELDS: ReadonlySet<string> = new Set([
  'routeMode',
  'useProxy',
  'interval',
  'autoUpdate'
])

export async function patchPluginItem(id: string, patch: Partial<IPluginItem>): Promise<void> {
  for (const key of Object.keys(patch)) {
    if (!EDITABLE_PLUGIN_FIELDS.has(key)) throw new Error(`Plugin field "${key}" is not editable`)
  }
  if (patch.routeMode !== undefined && !isRouteMode(patch.routeMode)) {
    throw new Error('Invalid routeMode')
  }
  // 过渡期镜像写：routeMode 变化时同步 useProxy，供降级到旧版本读取（最多丢失 auto/direct 之分）
  const next = patch.routeMode ? { ...patch, useProxy: patch.routeMode === 'proxy' } : patch
  await patchConfig(id, next)
  // 调度以关联的 profile item 为准：interval / autoUpdate 变化时同步过去并重建定时器（BL-003）
  if ('interval' in patch || 'autoUpdate' in patch) {
    const record = await getPluginItem(id)
    if (record?.profileId) {
      const schedule = pluginSchedule(record)
      await syncPluginProfileSchedule(record.profileId, {
        ...('interval' in patch ? { interval: schedule.interval } : {}),
        ...('autoUpdate' in patch ? { autoUpdate: schedule.autoUpdate } : {})
      })
    }
  }
  notifyRenderer()
}
