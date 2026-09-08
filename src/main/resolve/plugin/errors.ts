// 插件网络层共享的错误分类：稳定的错误 code、发送阶段（phase）、网关错误类型。
// http-client 产生带 code/phase 的底层错误；gateway 把它们映射为 GatewayError；
// route 用同一套 code 判断某个失败是否值得换一条路由（§1.3）。

export const CPX_TIMEOUT = 'CPX_TIMEOUT'
export const CPX_REDIRECT_REFUSED = 'CPX_REDIRECT_REFUSED'
export const CPX_RESPONSE_TOO_LARGE = 'CPX_RESPONSE_TOO_LARGE'
// guarded lookup 或 §1.4 预检拒绝了私网地址：终态，不再尝试任何路由。
export const CPX_GUARD_REFUSED = 'CPX_GUARD_REFUSED'
// 经代理的 https 隧道建立失败（代理对 CONNECT 返回非 2xx）：目标根本没有收到请求，按连接失败处理——
// 可回退到直连（§1.3），网关层视为不可达（§2.4）；不能当成目标的 HTTP 响应而固定路由。
export const CPX_PROXY_CONNECT_FAILED = 'CPX_PROXY_CONNECT_FAILED'

// pre-send：socket 尚未完成 connect / secureConnect，请求肯定没有到达服务器；
// possibly-sent：之后的一切错误，服务器可能已经收到并处理了请求。
export type ErrorPhase = 'pre-send' | 'possibly-sent'

export interface CodedError extends Error {
  code?: string
  phase?: ErrorPhase
  // 已收到 HTTP 响应头之后才失败（body 阶段出错 / 拒绝重定向 / 响应过大）：服务器已到达，
  // 路由不再回退（§1.3），网关按“有 status 的 transient”停止切换（§2.4）。
  status?: number
}

export function codeOf(e: unknown): string {
  if (typeof e !== 'object' || e === null) return ''
  const code = (e as CodedError).code
  return typeof code === 'string' ? code : ''
}

export function statusOf(e: unknown): number | undefined {
  if (typeof e !== 'object' || e === null) return undefined
  const status = (e as CodedError).status
  return typeof status === 'number' ? status : undefined
}

export function phaseOf(e: unknown): ErrorPhase | undefined {
  if (typeof e !== 'object' || e === null) return undefined
  const phase = (e as CodedError).phase
  return phase === 'pre-send' || phase === 'possibly-sent' ? phase : undefined
}

export function codedError(message: string, code: string, phase?: ErrorPhase): CodedError {
  const err = new Error(message) as CodedError
  err.code = code
  if (phase) err.phase = phase
  return err
}

// DNS 解析失败 / 连接拒绝 / TLS 失败 → 网关“不可达/已退役”信号（spec §5），交由编排层重新发现。
export const UNREACHABLE_CODES = new Set([
  CPX_PROXY_CONNECT_FAILED,
  'ENOTFOUND',
  'EAI_AGAIN',
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EHOSTDOWN',
  'ENETDOWN',
  'EPIPE',
  'EPROTO'
])

export function isUnreachableCode(code: string): boolean {
  if (UNREACHABLE_CODES.has(code)) return true
  // Node 的 TLS/证书错误 code 形如 ERR_TLS_*, ERR_SSL_*, CERT_*, SELF_SIGNED_*, UNABLE_TO_*, DEPTH_ZERO_*
  return /^(ERR_TLS|ERR_SSL|CERT_|SELF_SIGNED_|UNABLE_TO_|DEPTH_ZERO_)/.test(code)
}

export type GatewayErrorKind = 'revoked' | 'retired' | 'unreachable' | 'transient' | 'blocked'

export class GatewayError extends Error {
  kind: GatewayErrorKind
  status?: number
  phase?: ErrorPhase
  // §4.2：机场在错误 JSON 里主动写的 message，经白名单提取与清洗；卡片原样显示
  providerMessage?: string
  constructor(kind: GatewayErrorKind, message: string, status?: number, phase?: ErrorPhase) {
    super(message)
    this.name = 'GatewayError'
    this.kind = kind
    this.status = status
    if (phase) this.phase = phase
  }
}
