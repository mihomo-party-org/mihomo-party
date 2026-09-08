import type { IncomingHttpHeaders } from 'http'
import { parse } from '../../utils/yaml'
import { buildSignInput, signRequest, OP_CONFIG, OP_REVOKE } from './device'
import {
  CPX_GUARD_REFUSED,
  GatewayError,
  codeOf,
  isUnreachableCode,
  phaseOf,
  statusOf,
  type GatewayErrorKind
} from './errors'
import type { RoutedRequester } from './operation'
import { MAX_PROVIDER_MESSAGE, sanitizeProviderText } from './text'
import { isB64Bytes } from './encoding'
import { warnLog } from './log'

export { GatewayError, type GatewayErrorKind } from './errors'

const MAX_BYTES = 10 * 1024 * 1024

export interface GatewayTarget {
  gateway: string
  endpoints: IGatewayEndpoints
}

interface RawResult {
  status: number
  json: Record<string, unknown> | undefined
  text: string
  headers: IncomingHttpHeaders
}

function urlOf(t: GatewayTarget, ep: keyof IGatewayEndpoints): string {
  const u = new URL(t.endpoints[ep], t.gateway)
  // 第二道防线：拼出的 URL 必须仍落在网关 origin 上（防端点逃逸到其它 host，如反斜杠/编码技巧）。
  if (u.origin !== new URL(t.gateway).origin) {
    throw new GatewayError('transient', 'endpoint escaped gateway origin')
  }
  return u.toString()
}

// 错误映射（§1.6）：CPX_GUARD_REFUSED → blocked（终态）；已收到响应头后才失败 → 有 status 的 transient
// （410 → retired），服务器已到达，不换网关（§2.4）；UNREACHABLE_CODES / TLS → unreachable（缓存网关
// “不可达/已退役”信号，交由编排层重新发现，spec §5）；CPX_TIMEOUT 与其余 → transient（无 status）。
async function postJson(
  url: string,
  body: unknown,
  requester: RoutedRequester
): Promise<RawResult> {
  let res: { status: number; body: string; headers: IncomingHttpHeaders }
  try {
    res = await requester.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      maxBytes: MAX_BYTES
    })
  } catch (e) {
    if (e instanceof GatewayError) throw e
    const err = e as NodeJS.ErrnoException
    const code = codeOf(err)
    const status = statusOf(err)
    let kind: GatewayErrorKind
    if (code === CPX_GUARD_REFUSED) kind = 'blocked'
    else if (status === 410) kind = 'retired'
    else if (status !== undefined) kind = 'transient'
    else if (isUnreachableCode(code)) kind = 'unreachable'
    else kind = 'transient'
    throw new GatewayError(kind, err.message, status, phaseOf(err))
  }
  let json: Record<string, unknown> | undefined
  try {
    const parsed = JSON.parse(res.body)
    json =
      typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)
        : undefined
  } catch {
    json = undefined
  }
  return { status: res.status, json, text: res.body, headers: res.headers ?? {} }
}

// 所有错误类别（retired / revoked / 有 status 的 transient）都可以携带机场 message（§4.2）
function withProviderMessage(err: GatewayError, r: RawResult): GatewayError {
  const message = sanitizeProviderText(r.json?.message, MAX_PROVIDER_MESSAGE)
  if (message) err.providerMessage = message
  return err
}

function classify(r: RawResult): GatewayError | null {
  if (r.status === 410 || r.json?.error === 'gateway_retired') {
    return withProviderMessage(new GatewayError('retired', 'gateway retired', r.status), r)
  }
  if (r.json?.error === 'revoked' || r.json?.error === 'device_revoked') {
    return withProviderMessage(new GatewayError('revoked', 'device revoked', r.status), r)
  }
  if (r.status < 200 || r.status >= 300) {
    return withProviderMessage(
      new GatewayError('transient', `gateway status ${r.status}`, r.status),
      r
    )
  }
  return null
}

// 不透明 ASCII token（可见 ASCII，无空白/控制字符），长度 1..max
function isAsciiToken(s: string, max: number): boolean {
  return s.length > 0 && s.length <= max && /^[\x21-\x7e]+$/.test(s)
}

function isClashConfig(yamlText: string): boolean {
  let parsed: unknown
  try {
    parsed = parse(yamlText)
  } catch {
    return false
  }
  if (typeof parsed !== 'object' || parsed === null) return false
  const obj = parsed as Record<string, unknown>
  // 只做基本结构校验：proxies 必须是数组、proxy-providers 必须是映射。真值检查会让
  // `proxies: some-string` / `proxy-providers: true` 这类无法加载的内容覆盖仍可用的旧订阅。
  // 先拒绝任何"给出了但类型错误"的字段，再要求至少存在一个合法字段——否则一个合法字段会放行另一个错误字段。
  const proxies = obj['proxies']
  const providers = obj['proxy-providers']
  const isPlainObject = (v: unknown): boolean =>
    typeof v === 'object' && v !== null && !Array.isArray(v)
  // proxies 必须是对象数组，proxy-providers 必须是对象到对象的映射：拒绝 [null] / ["x"] / {p: true}
  // 这类结构上无法加载的内容，避免覆盖仍可用的旧订阅。（完整语义校验见 backlog：接入核心 checkProfileConfig。）
  if (proxies !== undefined) {
    if (!Array.isArray(proxies) || !proxies.every(isPlainObject)) return false
  }
  if (providers !== undefined) {
    if (!isPlainObject(providers)) return false
    if (!Object.values(providers as Record<string, unknown>).every(isPlainObject)) return false
  }
  return proxies !== undefined || providers !== undefined
}

export interface EnrollBody {
  code: string
  code_verifier: string
  redirect_uri: string
  client_id: string
  devicePubKey: string
  deviceId: string
}

export async function enroll(
  t: GatewayTarget,
  body: EnrollBody,
  requester: RoutedRequester
): Promise<void> {
  const r = await postJson(urlOf(t, 'enroll'), body, requester)
  const err = classify(r)
  if (err) throw err
}

export async function challenge(
  t: GatewayTarget,
  deviceId: string,
  requester: RoutedRequester
): Promise<{ nonceId: string; nonce: string; exp: number }> {
  const r = await postJson(urlOf(t, 'challenge'), { deviceId }, requester)
  const err = classify(r)
  if (err) throw err
  const j = r.json
  // 结构校验（spec §7）：nonceId 为不透明 ASCII ≤64；nonce 必须是 32 raw bytes 的标准 base64。
  // 坏数据按瞬时失败处理，避免畸形 nonce 进入签名串。
  if (
    !j ||
    typeof j.nonceId !== 'string' ||
    typeof j.nonce !== 'string' ||
    !isAsciiToken(j.nonceId, 64) ||
    !isB64Bytes(j.nonce, 32)
  ) {
    throw new GatewayError('transient', 'bad challenge response', r.status)
  }
  return { nonceId: j.nonceId, nonce: j.nonce, exp: Number(j.exp) || 0 }
}

interface DeviceCred {
  deviceId: string
  privKeyB64: string
}

async function signedPost(
  t: GatewayTarget,
  ep: 'config' | 'revoke',
  op: number,
  dev: DeviceCred,
  requester: RoutedRequester
): Promise<RawResult> {
  const ch = await challenge(t, dev.deviceId, requester)
  const nonceBuf = Buffer.from(ch.nonce, 'base64')
  const ts = Date.now()
  const input = buildSignInput(op, dev.deviceId, ch.nonceId, nonceBuf, ts)
  const sig = signRequest(dev.privKeyB64, input)
  return postJson(
    urlOf(t, ep),
    { deviceId: dev.deviceId, nonceId: ch.nonceId, nonce: ch.nonce, ts, sig },
    requester
  )
}

export interface ConfigResult {
  yaml: string
  // §5：/config 成功响应可选的 X-CPX-Discovery 头（"<payloadB64>.<sigB64>"），只取单一字符串头
  discovery?: string
}

const DISCOVERY_HEADER = 'x-cpx-discovery'

function singleHeader(headers: IncomingHttpHeaders, name: string): string | undefined {
  const v = headers[name]
  if (typeof v === 'string') return v
  if (Array.isArray(v)) void warnLog(`${name}: multiple header values ignored`)
  return undefined
}

export async function fetchConfig(
  t: GatewayTarget,
  dev: DeviceCred,
  requester: RoutedRequester
): Promise<ConfigResult> {
  const r = await signedPost(t, 'config', OP_CONFIG, dev, requester)
  const err = classify(r)
  if (err) throw err
  if (!isClashConfig(r.text)) {
    throw new GatewayError('transient', 'subscription is not a valid clash config', r.status)
  }
  const discovery = singleHeader(r.headers, DISCOVERY_HEADER)
  return discovery === undefined ? { yaml: r.text } : { yaml: r.text, discovery }
}

export async function revoke(
  t: GatewayTarget,
  dev: DeviceCred,
  requester: RoutedRequester
): Promise<void> {
  const r = await signedPost(t, 'revoke', OP_REVOKE, dev, requester)
  const err = classify(r)
  if (err) throw err
}
