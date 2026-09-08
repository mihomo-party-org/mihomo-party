// 签名发现文档（§5）：信封 "<payloadB64>.<sigB64>"，Ed25519 对 "CPX2-DISCOVERY\0" || payloadBytes 签名。
// 校验无需规范化：验的是收到的那串字节，验过之后才 JSON.parse。
import { verifyRequest } from './device'
import { isCanonicalB64, sha256Hex } from './encoding'
import {
  parseGatewayList,
  parseGatewayOrigin,
  isValidEndpointPath,
  normalizeEndpointPath
} from './gateway-url'
import { isForbiddenHost } from './net-guard'

// 域分离前缀（含结尾 NUL 字节）：防止同一密钥签出的其他类型消息被冒用
export const DISCOVERY_SIGN_PREFIX = Buffer.from('CPX2-DISCOVERY\u0000', 'utf-8')
// payload 字节上限（两处投放位置共用）：经 base64 与签名后约 5.6 KiB，在常见 8 KiB 单头限制内
export const MAX_DISCOVERY_PAYLOAD_BYTES = 4096
export const MAX_DISCOVERY_URLS = 8
const MAX_SEQ = Number.MAX_SAFE_INTEGER // 2^53 − 1
const PAYLOAD_KEYS = ['spec', 'seq', 'gateways', 'endpoints', 'loginUrl', 'discoveryUrls']
const REQUIRED_ENDPOINTS = ['enroll', 'challenge', 'config', 'revoke'] as const
const OPTIONAL_ENDPOINTS = ['bootstrap']

function fail(msg: string): never {
  throw new Error(`Invalid signed discovery: ${msg}`)
}

export function buildDiscoverySignInput(payloadBytes: Uint8Array): Buffer {
  return Buffer.concat([DISCOVERY_SIGN_PREFIX, Buffer.from(payloadBytes)])
}

function parseLoginUrl(v: unknown): string {
  if (typeof v !== 'string') fail('loginUrl must be a string')
  let u: URL
  try {
    u = new URL(v)
  } catch {
    fail('loginUrl must be a valid URL')
  }
  if (u.protocol !== 'https:') fail('loginUrl must be https')
  if (u.username || u.password) fail('loginUrl must not contain userinfo')
  if (u.search || u.hash) fail('loginUrl must not contain query or fragment')
  if (isForbiddenHost(u.hostname)) fail('loginUrl must be a public host')
  return u.toString()
}

// 缺失 = 不改（返回 undefined）；[] = 清空；非空时规则同 .cpx（1..8、去重、不与 loginUrl 同 origin）
function parseDiscoveryUrls(v: unknown, loginOrigin: string | undefined): string[] | undefined {
  if (v === undefined) return undefined
  if (!Array.isArray(v) || v.length > MAX_DISCOVERY_URLS) {
    fail(`discoveryUrls must be an array of at most ${MAX_DISCOVERY_URLS} origins`)
  }
  const out: string[] = []
  for (const item of v) {
    const origin = parseGatewayOrigin(item)
    if (!origin) fail('discoveryUrls entries must be public https origins')
    if (loginOrigin && origin === loginOrigin) {
      fail('discoveryUrls must not repeat the loginUrl origin')
    }
    if (out.includes(origin)) fail('discoveryUrls must not contain duplicates')
    out.push(origin)
  }
  return out
}

function parsePayload(bytes: Buffer): IDiscoveryPayload {
  // 严格 UTF-8：非法字节序列直接拒绝，而不是被替换成 U+FFFD 后混进端点路径
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    fail('payload is not valid UTF-8')
  }
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    fail('payload is not valid JSON')
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    fail('payload must be an object')
  }
  const obj = raw as Record<string, unknown>
  for (const k of Object.keys(obj)) {
    if (!PAYLOAD_KEYS.includes(k)) fail(`unknown key "${k}"`)
  }
  if (obj.spec !== 'cpx-plugin/2') fail('spec must be "cpx-plugin/2"')
  const seq = obj.seq
  if (typeof seq !== 'number' || !Number.isInteger(seq) || seq < 1 || seq > MAX_SEQ) {
    fail('seq must be an integer in 1..2^53-1')
  }
  const gateways = parseGatewayList(obj.gateways)
  if (!gateways) fail('gateways must be 1..3 public https origins')
  if (typeof obj.endpoints !== 'object' || obj.endpoints === null || Array.isArray(obj.endpoints)) {
    fail('endpoints required')
  }
  const e = obj.endpoints as Record<string, unknown>
  for (const k of Object.keys(e)) {
    if (!REQUIRED_ENDPOINTS.includes(k as never) && !OPTIONAL_ENDPOINTS.includes(k)) {
      fail(`unknown endpoint "${k}"`)
    }
    if (!isValidEndpointPath(e[k])) fail(`endpoints.${k} must be a relative path`)
  }
  const endpoints = {} as IGatewayEndpoints
  for (const k of REQUIRED_ENDPOINTS) {
    const v = e[k]
    if (!isValidEndpointPath(v)) fail(`endpoints.${k} required`)
    endpoints[k] = normalizeEndpointPath(v)
  }
  const loginUrl = obj.loginUrl === undefined ? undefined : parseLoginUrl(obj.loginUrl)
  const discoveryUrls = parseDiscoveryUrls(
    obj.discoveryUrls,
    loginUrl ? new URL(loginUrl).origin : undefined
  )
  const payload: IDiscoveryPayload = { spec: 'cpx-plugin/2', seq, gateways, endpoints }
  if (loginUrl !== undefined) payload.loginUrl = loginUrl
  if (discoveryUrls !== undefined) payload.discoveryUrls = discoveryUrls
  return payload
}

// 格式错 / 验签失败抛 Error。digest = SHA-256(payloadBytes) 的 hex。
export function parseSigned(
  signed: unknown,
  pubKeyB64: string
): { payload: IDiscoveryPayload; digest: string } {
  if (typeof signed !== 'string') fail('signed must be a string')
  const parts = signed.split('.')
  if (parts.length !== 2) fail('signed must contain exactly one "."')
  const [payloadB64, sigB64] = parts
  if (!isCanonicalB64(payloadB64) || !isCanonicalB64(sigB64)) fail('non-canonical base64')
  const sig = Buffer.from(sigB64, 'base64')
  if (sig.length !== 64) fail('signature must be exactly 64 bytes')
  const payloadBytes = Buffer.from(payloadB64, 'base64')
  if (payloadBytes.length === 0 || payloadBytes.length > MAX_DISCOVERY_PAYLOAD_BYTES) {
    fail(`payload must be 1..${MAX_DISCOVERY_PAYLOAD_BYTES} bytes`)
  }
  let ok = false
  try {
    ok = verifyRequest(pubKeyB64, buildDiscoverySignInput(payloadBytes), sigB64)
  } catch {
    ok = false
  }
  if (!ok) fail('signature verification failed')
  return { payload: parsePayload(payloadBytes), digest: sha256Hex(payloadBytes) }
}

export type SeqVerdict = 'accept' | 'align' | 'rollback' | 'equivocation'

// §5.3 seq / digest 规则：未存 → 任意接受；seq > stored → 接受；seq === stored 且 digest 相同 → 对齐；
// seq === stored 且 digest 不同 → 拒绝（签发方 equivocation / 多 CDN 不一致）；seq < stored → 拒绝。
export function checkSeq(seq: number, digest: string, signer: DiscoverySigner): SeqVerdict {
  if (signer.minSeq === undefined) return 'accept'
  if (seq > signer.minSeq) return 'accept'
  if (seq < signer.minSeq) return 'rollback'
  return digest === signer.currentDigest ? 'align' : 'equivocation'
}
