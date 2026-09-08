import {
  parseGatewayOrigin,
  parseGatewayList,
  isValidEndpointPath,
  normalizeEndpointPath
} from './gateway-url'
import { checkSeq, parseSigned } from './discovery-sig'
import { warnLog } from './log'
import type { OperationContext, RoutedRequester } from './operation'

const MAX_BYTES = 64 * 1024

export interface DiscoverInput {
  // 发现源顺序：[loginUrl 的 origin, …discoveryUrls]；每个源请求 https://<origin>/.well-known/cpx-gateway
  sources: string[]
  // §5：插件带 providerPubKey 时必须提供；此时 well-known 必须含 signed，且顶层字段与 payload 一致
  signer?: DiscoverySigner
}

export function originOf(url: string): string {
  return new URL(url).origin
}

function fail(msg: string): never {
  throw new Error(`Invalid gateway discovery: ${msg}`)
}

function assertHttpsOrigin(v: unknown, where: string): string {
  const origin = parseGatewayOrigin(v)
  if (!origin) fail(`${where} must be a public https origin with no path/query/fragment/userinfo`)
  return origin
}

function assertRelPath(v: unknown, where: string): string {
  if (!isValidEndpointPath(v)) {
    fail(`${where} must be a relative path starting with "/" (no scheme/host/query/fragment)`)
  }
  return normalizeEndpointPath(v)
}

interface WellKnownDocument {
  wk: IGatewayWellKnown
  signed: unknown
}

function parseWellKnownDocument(body: string): WellKnownDocument {
  let raw: unknown
  try {
    raw = JSON.parse(body)
  } catch {
    fail('not valid JSON')
  }
  if (typeof raw !== 'object' || raw === null) fail('must be an object')
  const obj = raw as Record<string, unknown>
  if (obj.spec !== 'cpx-plugin/2') fail('spec must be "cpx-plugin/2"')
  const gateway = assertHttpsOrigin(obj.gateway, 'gateway')
  // §2.2：gateways 可选（1..3、去重）；存在时 gateway 必须等于归一化后的 gateways[0]，否则整份文档无效。
  let gateways: string[]
  if (obj.gateways === undefined) {
    gateways = [gateway]
  } else {
    const list = parseGatewayList(obj.gateways)
    if (!list) fail('gateways must be 1..3 public https origins')
    if (list[0] !== gateway) fail('gateway must equal gateways[0]')
    gateways = list
  }
  if (typeof obj.endpoints !== 'object' || obj.endpoints === null) fail('endpoints required')
  const e = obj.endpoints as Record<string, unknown>
  return {
    wk: {
      spec: 'cpx-plugin/2',
      gateways,
      endpoints: {
        enroll: assertRelPath(e.enroll, 'endpoints.enroll'),
        challenge: assertRelPath(e.challenge, 'endpoints.challenge'),
        config: assertRelPath(e.config, 'endpoints.config'),
        revoke: assertRelPath(e.revoke, 'endpoints.revoke')
      }
    },
    signed: obj.signed
  }
}

export function parseWellKnown(body: string): IGatewayWellKnown {
  return parseWellKnownDocument(body).wk
}

function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

function sameEndpoints(a: IGatewayEndpoints, b: IGatewayEndpoints): boolean {
  return (
    a.enroll === b.enroll &&
    a.challenge === b.challenge &&
    a.config === b.config &&
    a.revoke === b.revoke
  )
}

async function fetchWellKnown(
  source: string,
  requester: RoutedRequester,
  signer: DiscoverySigner | undefined
): Promise<IDiscoveryCandidate> {
  const url = `${source}/.well-known/cpx-gateway`
  const res = await requester.request(url, { method: 'GET', maxBytes: MAX_BYTES })
  if (res.status < 200 || res.status >= 300) {
    const err = new Error(`Discovery failed: status ${res.status}`) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  const { wk, signed } = parseWellKnownDocument(res.body)
  // 无密钥：走无签名路径，忽略 signed
  if (!signer) return { gateways: wk.gateways, endpoints: wk.endpoints }
  // 有密钥而文档无 signed：该源发现失败（降级攻击防护）
  if (signed === undefined) fail('signed is required for a plugin with providerPubKey')
  const { payload, digest } = parseSigned(signed, signer.pubKeyB64)
  // 顶层字段与 payload 归一化比较，不一致 → 整个源无效，不应用任何字段
  if (!sameList(wk.gateways, payload.gateways) || !sameEndpoints(wk.endpoints, payload.endpoints)) {
    fail('top-level gateway fields disagree with the signed payload')
  }
  const verdict = checkSeq(payload.seq, digest, signer)
  if (verdict === 'rollback' || verdict === 'equivocation') {
    void warnLog(`discovery source ${source} rejected: ${verdict} (seq ${payload.seq})`)
    fail(`signed payload rejected: ${verdict}`)
  }
  const candidate: IDiscoveryCandidate = {
    gateways: payload.gateways,
    endpoints: payload.endpoints,
    seq: payload.seq,
    digest
  }
  if (payload.loginUrl !== undefined) candidate.loginUrl = payload.loginUrl
  if (payload.discoveryUrls !== undefined) candidate.discoveryUrls = payload.discoveryUrls
  return candidate
}

// §3：逐个发现源尝试。发现阶段任何失败（网络、非 2xx、JSON / 字段无效、guard 拒绝）都试下一个源——
// 备用源可能只是静态 CDN 文件，404 是正常的“此处不提供”。全部失败 → 抛最后一个错误。
// 每个源是独立 origin，路由粘性自动分作用域；整体受 op 预算约束。
export async function discoverGateway(
  input: DiscoverInput,
  ctx: OperationContext
): Promise<IDiscoveryCandidate> {
  let lastError: unknown
  for (const source of input.sources) {
    try {
      return await fetchWellKnown(source, ctx.requester, input.signer)
    } catch (e) {
      lastError = e
    }
  }
  throw lastError ?? new Error('Invalid gateway discovery: no discovery sources')
}
