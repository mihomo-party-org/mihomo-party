import { isForbiddenHost } from './net-guard'
import { parseGatewayOrigin } from './gateway-url'
import { MAX_PROVIDER_DESCRIPTION, sanitizeProviderText } from './text'
import { isB64Bytes } from './encoding'

const ICON_MAX_LEN = 64 * 1024
const MAX_DISCOVERY_URLS = 8
const ICON_PREFIXES = [
  'data:image/png;base64,',
  'data:image/jpeg;base64,',
  'data:image/webp;base64,'
]

function fail(msg: string): never {
  throw new Error(`Invalid plugin descriptor: ${msg}`)
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function assertOnlyKeys(obj: Record<string, unknown>, allowed: string[], where: string): void {
  for (const k of Object.keys(obj)) {
    if (!allowed.includes(k)) fail(`unexpected field "${k}" in ${where}`)
  }
}

function validateIcon(icon: unknown): void {
  if (icon === undefined) return
  if (typeof icon !== 'string') fail('provider.icon must be a string')
  if (icon.length > ICON_MAX_LEN) fail('provider.icon too large')
  if (!ICON_PREFIXES.some((p) => icon.startsWith(p))) {
    fail('provider.icon must be a small png/jpeg/webp data uri (no svg, no external url)')
  }
}

function assertHttpsUrl(v: unknown, where: string): URL {
  if (typeof v !== 'string') fail(`${where} must be a string`)
  let u: URL
  try {
    u = new URL(v)
  } catch {
    fail(`${where} must be a valid URL`)
  }
  if (u.protocol !== 'https:') fail(`${where} must be https`)
  if (u.username || u.password) fail(`${where} must not contain userinfo`)
  // 拒绝字面私网/环回/保留 IP 与 localhost/*.localhost（无需 DNS，代理模式下同样生效）。
  // 域名解析到私网的拦截走加固客户端的 guarded lookup（直连模式）；代理模式由 spec §11 标注为安全降级。
  if (isForbiddenHost(u.hostname)) fail(`${where} must be a public host`)
  return u
}

// §3：备用发现源。每项为公网 https origin（parseGatewayOrigin 规则），1..8 个，去重，不得与 loginUrl 同 origin。
// 信任级别与 loginUrl 相同——都是用户导入时接受的静态信任根。
function validateDiscoveryUrls(v: unknown, loginOrigin: string): string[] | undefined {
  if (v === undefined) return undefined
  if (!Array.isArray(v) || v.length < 1 || v.length > MAX_DISCOVERY_URLS) {
    fail(`discoveryUrls must list 1..${MAX_DISCOVERY_URLS} public https origins`)
  }
  const out: string[] = []
  for (const item of v) {
    const origin = parseGatewayOrigin(item)
    if (!origin) {
      fail(
        'discoveryUrls entries must be public https origins with no path/query/fragment/userinfo'
      )
    }
    if (origin === loginOrigin) fail('discoveryUrls must not repeat the loginUrl origin')
    if (out.includes(origin)) fail('discoveryUrls must not contain duplicates')
    out.push(origin)
  }
  return out
}

export function parseDescriptor(jsonText: string): IPluginDescriptor {
  let raw: unknown
  try {
    raw = JSON.parse(jsonText)
  } catch {
    fail('not valid JSON')
  }
  if (!isObject(raw)) fail('must be an object')
  if (raw.magic !== 'CPXF') fail('magic must be "CPXF"')
  if (raw.v === 1) {
    throw new Error(
      'Plugin file format is outdated (v1); please obtain the new file from your provider'
    )
  }
  if (raw.v !== 2) fail('v must be 2')
  if (raw.spec !== 'cpx-plugin/2') fail('spec must be "cpx-plugin/2"')
  assertOnlyKeys(
    raw,
    ['magic', 'v', 'spec', 'loginUrl', 'provider', 'discoveryUrls', 'providerPubKey'],
    'descriptor'
  )
  // §5：签名一旦在 .cpx 中声明即强制校验；公钥必须是规范 base64 的 32 字节
  if (raw.providerPubKey !== undefined && !isB64Bytes(raw.providerPubKey, 32)) {
    fail('providerPubKey must be a 32-byte Ed25519 public key in standard base64')
  }

  const loginUrl = assertHttpsUrl(raw.loginUrl, 'loginUrl')
  if (loginUrl.search || loginUrl.hash) fail('loginUrl must not contain query or fragment')
  const discoveryUrls = validateDiscoveryUrls(raw.discoveryUrls, loginUrl.origin)

  if (!isObject(raw.provider)) fail('provider must be an object')
  assertOnlyKeys(raw.provider, ['name', 'icon', 'site', 'description'], 'provider')
  if (typeof raw.provider.name !== 'string' || raw.provider.name.length === 0) {
    fail('provider.name required')
  }
  validateIcon(raw.provider.icon)
  if (raw.provider.site !== undefined) assertHttpsUrl(raw.provider.site, 'provider.site')
  if (raw.provider.description !== undefined && typeof raw.provider.description !== 'string') {
    fail('provider.description must be a string')
  }
  // §4.2：机场静态说明，清洗规则同 message，截断 500 码点；清洗后为空则视为未提供
  const description = sanitizeProviderText(raw.provider.description, MAX_PROVIDER_DESCRIPTION)

  const descriptor = raw as unknown as IPluginDescriptor
  if (discoveryUrls) descriptor.discoveryUrls = discoveryUrls
  if (description) descriptor.provider.description = description
  else delete descriptor.provider.description
  return descriptor
}
