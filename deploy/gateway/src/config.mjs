import { parseOrigin } from './discovery.mjs'

export const MAX_GATEWAY_ORIGINS = 3

function normalizeOrigin(raw) {
  let u
  try {
    u = new URL(raw.trim())
  } catch {
    throw new Error(`GATEWAY_ORIGINS: "${raw}" is not a valid URL`)
  }
  if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash) {
    throw new Error(`GATEWAY_ORIGINS: "${raw}" must be a plain https origin`)
  }
  if (u.pathname && u.pathname !== '/') {
    throw new Error(`GATEWAY_ORIGINS: "${raw}" must not contain a path`)
  }
  return u.origin
}

// Comma-separated list, 1..3 entries, normalized and deduplicated. Falls back to [publicOrigin].
export function parseGatewayOrigins(value, publicOrigin) {
  if (!value || !value.trim()) return [normalizeOrigin(publicOrigin)]
  const out = []
  for (const part of value.split(',')) {
    const raw = part.trim()
    if (!raw) continue
    // Explicit entries are published to every client, which rejects the WHOLE list when any
    // origin is private / loopback (client gateway-url.ts parseGatewayList) — same rule here.
    const origin = parseOrigin(raw)
    if (!origin) {
      throw new Error(
        `GATEWAY_ORIGINS: "${raw}" must be a public https origin (no path/query/userinfo)`
      )
    }
    if (!out.includes(origin)) out.push(origin)
  }
  if (out.length < 1 || out.length > MAX_GATEWAY_ORIGINS) {
    throw new Error(`GATEWAY_ORIGINS must list 1..${MAX_GATEWAY_ORIGINS} origins`)
  }
  return out
}

// Load configuration from an environment object (injectable for tests). Pure: no I/O.
// The origin CA file, if configured, is read separately by server.mjs.
export function loadConfig(env = process.env) {
  const num = (v, d) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : d
  }
  const domain = (env.DOMAINS || env.DOMAIN || 'localhost').split(',')[0].trim()
  const publicOrigin = env.PUBLIC_ORIGIN || `https://${domain}`
  return Object.freeze({
    port: num(env.PORT, 8080),
    dbPath: env.DB_PATH || '/data/gateway.db',
    publicOrigin,
    // §2.2: 1..3 https origins served by THIS process. All of them must share the same
    // in-memory code / nonce / rate-limit state, so multiple replicas are not supported.
    gatewayOrigins: parseGatewayOrigins(env.GATEWAY_ORIGINS, publicOrigin),
    deviceLimitDefault: num(env.DEVICE_LIMIT_DEFAULT, 3),
    codeTtlMs: num(env.CODE_TTL_MS, 60000),
    nonceTtlMs: num(env.NONCE_TTL_MS, 60000),
    noncePoolMax: num(env.NONCE_POOL_MAX, 8),
    clockSkewMs: num(env.CLOCK_SKEW_MS, 300000),
    loginMax: num(env.LOGIN_MAX, 10),
    loginWindowMs: num(env.LOGIN_WINDOW_MS, 60000),
    subTimeoutMs: num(env.SUB_TIMEOUT_MS, 30000),
    subMaxBytes: num(env.SUB_MAX_BYTES, 10 * 1024 * 1024),
    retired: env.RETIRED === 'true',
    originCaFile: env.ORIGIN_CA_FILE || '',
    // §4: optional JSON file { device_revoked, device_limit, gateway_retired } of human-readable
    // messages attached to the matching error responses. Read by server.mjs.
    messagesFile: env.MESSAGES_FILE || '',
    // §5a: pre-signed discovery envelope file ("<payloadB64>.<sigB64>"). The private key never
    // enters this process; sign offline with `cpx-admin sign-discovery`. Read by server.mjs.
    discoverySignedFile: env.DISCOVERY_SIGNED_FILE || ''
  })
}
