import { isForbiddenHost } from './net-guard'

// 网关 origin / 端点 path 的字面校验（无 DNS、无网络）。discovery（解析 .well-known）与
// vault（解密缓存的网关）共用，避免两处校验语义分叉。

// 校验并归一化网关 origin：必须 https、无 userinfo、无 path/query/fragment、host 非私网/环回/localhost。
// 合法返回 origin 字符串（scheme + host[+port]），非法返回 null。
export function parseGatewayOrigin(v: unknown): string | null {
  if (typeof v !== 'string') return null
  let u: URL
  try {
    u = new URL(v)
  } catch {
    return null
  }
  if (u.protocol !== 'https:') return null
  if (u.username || u.password) return null
  if (u.search || u.hash || (u.pathname && u.pathname !== '/')) return null
  if (isForbiddenHost(u.hostname)) return null
  return u.origin
}

export const MAX_GATEWAYS = 3

// 网关列表（§2.2）：1..3 个，逐个通过 parseGatewayOrigin，按归一化后的 origin 去重。任一项非法 → null。
export function parseGatewayList(v: unknown): string[] | null {
  if (!Array.isArray(v) || v.length < 1 || v.length > MAX_GATEWAYS) return null
  const out: string[] = []
  for (const item of v) {
    const origin = parseGatewayOrigin(item)
    if (!origin) return null
    if (!out.includes(origin)) out.push(origin)
  }
  return out
}

// 端点必须是以 '/' 开头的相对 path：不得为协议相对（//host）、不得含 scheme/host/query/fragment，
// 也不得含反斜杠 —— WHATWG URL 在 http(s) 下把 '\' 当作 '/'，故 '/\evil/x' 会逃逸到另一个 host。
// 端点路径归一化（§2.4 去重键、§5.2 顶层 / payload 比较）：先经 isValidEndpointPath，再按 WHATWG 解析出
// 实际请求会使用的 pathname（"." / ".." 被解析，百分号编码取解析器结果）。gateway.ts 的 urlOf 用同一解析规则，
// 因此归一化后的路径就是真正发出的路径；签名与 digest 仍按原始 payload 字节计算，不受影响。
export function normalizeEndpointPath(v: string): string {
  const path = new URL(v, 'https://cpx.invalid').pathname
  // "/a/..//x" 解析后的 pathname 是 "//x"：作为相对引用再次解析会变成协议相对地址（另一个 host）。
  // 前置 "/." 保持它仍是原网关下的路径 "//x"（与基线实际请求一致），且再次归一化结果不变。
  return path.startsWith('//') ? '/.' + path : path
}

export function isValidEndpointPath(v: unknown): v is string {
  if (typeof v !== 'string' || !v.startsWith('/')) return false
  if (
    v.startsWith('//') ||
    v.includes('\\') ||
    v.includes('?') ||
    v.includes('#') ||
    /^[a-z][a-z0-9+.-]*:/i.test(v)
  ) {
    return false
  }
  return true
}
