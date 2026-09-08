// 路由（route）：一次 HTTP 请求走哪条出口。direct / proxy（本地混合端口）/ bootstrap:<i>（§6 临时核心）。
// RouteProvider 是 operation.ts 与具体路由来源之间的 seam：auto 模式给出 [首选, 另一条] 两个候选，
// 由 operation.ts 按 §1.3 决定是否回退；direct / proxy 为用户显式覆盖，只有一条候选；bootstrap 在 §6c 注入。
import {
  CPX_GUARD_REFUSED,
  CPX_PROXY_CONNECT_FAILED,
  CPX_TIMEOUT,
  codedError,
  codeOf,
  isUnreachableCode,
  phaseOf,
  statusOf
} from './errors'
import { resolveAllPublicOrThrow, type ResolveAll } from './net-guard'
import { abortable } from './abortable'
import type { RetryPolicy } from './operation'

export type BaseRoute = 'direct' | 'proxy'
export type RouteKey = BaseRoute | `bootstrap:${number}`

export interface RouteProxy {
  host: string
  port: number
  auth?: { user: string; pass: string }
}

export interface RouteProvider {
  candidates(): Promise<RouteKey[]>
  proxyFor(key: RouteKey): Promise<RouteProxy | undefined>
  // §1.4：非 direct 路由对某 origin 发第一个请求前必须先过一次 guarded 判定（auto 模式）。
  // 显式 routeMode=proxy 不做预检，保持今天已接受的降级。
  readonly guardNonDirect: boolean
  // §0.4 规则 5：aborted=false 用剩余预算做正常清理；aborted=true 执行不可取消的紧急清理。
  dispose(aborted: boolean): Promise<void>
}

export type ProxyResolver = () => Promise<RouteProxy>

// lastGoodRoute 只能是 direct | proxy；bootstrap 不持久化。
export function baseRouteOf(key: RouteKey): BaseRoute | undefined {
  return key === 'direct' || key === 'proxy' ? key : undefined
}

export function isBaseRoute(v: unknown): v is BaseRoute {
  return v === 'direct' || v === 'proxy'
}

export function isRouteMode(v: unknown): v is IPluginRouteMode {
  return v === 'auto' || v === 'direct' || v === 'proxy'
}

// 本地混合端口代理。惰性解析：只有真正走 proxy 路由时才读取核心配置。
export async function resolveLocalProxy(): Promise<RouteProxy> {
  const { getControledMihomoConfig } = await import('../../config/controledMihomo')
  const { 'mixed-port': port = 7890, authentication = [] } = await getControledMihomoConfig()
  // 混合端口关闭（0）或非法：代理不可用。不能回落到别的端口——那会把请求和核心的代理凭据送给无关的本地服务。
  // 按隧道建立失败（pre-send）抛出：auto 回退直连，显式 proxy 按不可达处理
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw codedError(
      'Local proxy is not available (mixed-port disabled)',
      CPX_PROXY_CONNECT_FAILED,
      'pre-send'
    )
  }
  // 核心开启了 inbound 认证时，环回请求也可能被要求认证（skip-auth-prefixes 未含环回）：带上第一组凭据。
  // 环回被跳过认证时多带的凭据会被忽略，无副作用。凭据按第一个冒号切分 user:pass。
  const cred = authentication.find((a) => typeof a === 'string' && a.includes(':'))
  if (!cred) return { host: '127.0.0.1', port }
  const i = cred.indexOf(':')
  return { host: '127.0.0.1', port, auth: { user: cred.slice(0, i), pass: cred.slice(i + 1) } }
}

function lazyProxy(
  resolveProxy: ProxyResolver
): (key: RouteKey) => Promise<RouteProxy | undefined> {
  let proxy: Promise<RouteProxy> | undefined
  return async (key) => {
    if (key !== 'proxy') return undefined
    proxy ??= resolveProxy()
    return proxy
  }
}

export function singleRouteProvider(
  route: BaseRoute,
  resolveProxy: ProxyResolver = resolveLocalProxy
): RouteProvider {
  return {
    candidates: async () => [route],
    proxyFor: lazyProxy(resolveProxy),
    guardNonDirect: false,
    dispose: async () => {}
  }
}

// auto：候选顺序 [initialRoute ?? lastGoodRoute ?? 'direct', 另一条]。
export function autoRouteProvider(
  first: BaseRoute,
  resolveProxy: ProxyResolver = resolveLocalProxy
): RouteProvider {
  const second: BaseRoute = first === 'direct' ? 'proxy' : 'direct'
  return {
    candidates: async () => [first, second],
    proxyFor: lazyProxy(resolveProxy),
    guardNonDirect: true,
    dispose: async () => {}
  }
}

// 读时推导（§1.5 五行迁移表），严格对应旧 netOpts 的继承语义：
// routeMode 有 → 取其值；无 → useProxy=true → proxy，false → auto；都无 → 全局 true → proxy，否则 auto。
export function effectiveRouteMode(item: IPluginItem, app: IAppConfig): IPluginRouteMode {
  if (isRouteMode(item.routeMode)) return item.routeMode
  if (typeof item.useProxy === 'boolean') return item.useProxy ? 'proxy' : 'auto'
  return app.pluginUseProxy ? 'proxy' : 'auto'
}

export function createRouteProvider(
  item: IPluginItem,
  app: IAppConfig,
  initialRoute?: BaseRoute,
  resolveProxy?: ProxyResolver
): RouteProvider {
  const mode = effectiveRouteMode(item, app)
  if (mode !== 'auto') return singleRouteProvider(mode, resolveProxy)
  const lastGood = isBaseRoute(item.lastGoodRoute) ? item.lastGoodRoute : undefined
  return autoRouteProvider(initialRoute ?? lastGood ?? 'direct', resolveProxy)
}

// §1.3：可回退失败 = 网络 errno（UNREACHABLE_CODES / TLS）与 CPX_TIMEOUT。其余（任意 HTTP 响应、
// 拒绝重定向、响应过大、guard 拒绝）一律不回退。pre-send-only（enroll）：只有 phase === 'pre-send'
// 且非超时的可回退错误才回退。
export function isFailoverError(e: unknown, policy: RetryPolicy): boolean {
  const code = codeOf(e)
  if (code === CPX_GUARD_REFUSED) return false
  // 已收到 HTTP 响应头（body 阶段才失败）：服务器已到达，换路无用（§1.3 “任意 HTTP 响应”）
  if (statusOf(e) !== undefined) return false
  const failoverClass = code === CPX_TIMEOUT || isUnreachableCode(code)
  if (!failoverClass) return false
  if (policy === 'safe') return true
  return code !== CPX_TIMEOUT && phaseOf(e) === 'pre-send'
}

function stripBrackets(hostname: string): string {
  return hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname
}

// §1.4 预检：在非 guarded 路由（proxy / bootstrap）之前用同一套 guarded 判定解析目标 host。
// 任一地址为私网 → CPX_GUARD_REFUSED（终态）；解析失败（NXDOMAIN / EAI_AGAIN）→ 允许经代理
// （代理侧会自行解析，这正是 DNS 被封的用户需要代理的原因）；全部公网 → 允许。
// 预检也是 op 内的等待（§0.4 规则 1），必须接收同一个 signal：中止映射为 CPX_TIMEOUT。
export async function preflightGuard(
  hostname: string,
  resolveAll?: ResolveAll,
  signal?: AbortSignal,
  timeoutMs?: number
): Promise<void> {
  try {
    await abortable(resolveAllPublicOrThrow(stripBrackets(hostname), resolveAll), signal, timeoutMs)
  } catch (e) {
    const code = codeOf(e)
    if (code === CPX_GUARD_REFUSED || code === CPX_TIMEOUT) throw e
  }
}

// op 内不受底层取消机制约束的等待统一经 abortable 接收同一个 signal（实现见 abortable.ts；这里保留导出）
export { abortable }
