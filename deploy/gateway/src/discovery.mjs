// Signed discovery document helpers shared by the offline signer (admin.mjs) and the server:
// the same field rules the client enforces (src/main/resolve/plugin/discovery-sig.ts), applied
// BEFORE a document is signed or served, so a provider cannot publish a document every keyed
// client will reject. Zero dependencies.
import { DISCOVERY_MAX_PAYLOAD_BYTES, isCanonicalB64 } from './crypto.mjs'

const PAYLOAD_KEYS = new Set(['spec', 'seq', 'gateways', 'endpoints', 'loginUrl', 'discoveryUrls'])
const REQUIRED_ENDPOINTS = ['enroll', 'challenge', 'config', 'revoke']
const OPTIONAL_ENDPOINTS = new Set(['bootstrap'])
const MAX_GATEWAYS = 3
const MAX_DISCOVERY_URLS = 8
const MAX_SEQ = Number.MAX_SAFE_INTEGER

function isPrivateIpv4(ip) {
  const p = ip.split('.').map(Number)
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true
  const [a, b, c] = p
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  )
}

// Expand an IPv6 string to 8 16-bit hextets; null if unparseable. Mirrors the client's
// net-guard.ts so that hex-form IPv4-mapped addresses (what WHATWG URL normalizes
// "::ffff:127.0.0.1" into) are judged exactly like the dotted form.
function expandIpv6(input) {
  let ip = input.toLowerCase()
  const pct = ip.indexOf('%')
  if (pct >= 0) ip = ip.slice(0, pct)
  const halves = ip.split('::')
  if (halves.length > 2) return null
  const parseGroups = (str) => {
    if (str === '') return []
    const groups = str.split(':')
    const out = []
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i]
      if (g.includes('.')) {
        if (i !== groups.length - 1) return null
        const o = g.split('.').map(Number)
        if (o.length !== 4 || o.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null
        out.push((((o[0] << 8) | o[1]) >>> 0).toString(16))
        out.push((((o[2] << 8) | o[3]) >>> 0).toString(16))
      } else {
        if (!/^[0-9a-f]{1,4}$/.test(g)) return null
        out.push(g)
      }
    }
    return out
  }
  const head = parseGroups(halves[0])
  if (head === null) return null
  let groups
  if (halves.length === 2) {
    const tail = parseGroups(halves[1])
    if (tail === null) return null
    const missing = 8 - head.length - tail.length
    if (missing < 1) return null
    groups = [...head, ...Array(missing).fill('0'), ...tail]
  } else {
    groups = head
  }
  if (groups.length !== 8) return null
  return groups.map((g) => parseInt(g, 16))
}

// Same special ranges as the client: unspecified, loopback, link-local, ULA, discard 100::/64,
// documentation 2001:db8::/32, 6to4 2002::/16, multicast, and IPv4-mapped with a private IPv4.
function isPrivateIpv6(ip) {
  const h = expandIpv6(ip)
  if (!h) return true
  if (h.every((x) => x === 0)) return true
  if (h.slice(0, 7).every((x) => x === 0) && h[7] === 1) return true
  if ((h[0] & 0xffc0) === 0xfe80) return true
  if ((h[0] & 0xfe00) === 0xfc00) return true
  if (h[0] === 0x0100 && h[1] === 0 && h[2] === 0 && h[3] === 0) return true
  if (h[0] === 0x2001 && h[1] === 0x0db8) return true
  if (h[0] === 0x2002) return true
  if ((h[0] & 0xff00) === 0xff00) return true
  if (h[0] === 0 && h[1] === 0 && h[2] === 0 && h[3] === 0 && h[4] === 0 && h[5] === 0xffff) {
    const v4 = `${(h[6] >> 8) & 0xff}.${h[6] & 0xff}.${(h[7] >> 8) & 0xff}.${h[7] & 0xff}`
    return isPrivateIpv4(v4)
  }
  return false
}

export function isForbiddenHost(host) {
  let h = String(host).trim().toLowerCase()
  if (h.startsWith('[') && h.endsWith(']')) h = h.slice(1, -1)
  if (h.endsWith('.')) h = h.slice(0, -1)
  if (h === '' || h === 'localhost' || h.endsWith('.localhost')) return true
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) return isPrivateIpv4(h)
  if (h.includes(':')) return isPrivateIpv6(h)
  return false
}

// https origin only: scheme + host (+ port); no path, query, fragment, userinfo; public host.
export function parseOrigin(value) {
  if (typeof value !== 'string') return null
  let u
  try {
    u = new URL(value)
  } catch {
    return null
  }
  if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash) return null
  if (u.pathname && u.pathname !== '/') return null
  if (isForbiddenHost(u.hostname)) return null
  return u.origin
}

export function isValidEndpointPath(v) {
  if (typeof v !== 'string' || !v.startsWith('/')) return false
  if (v.startsWith('//') || v.includes('\\') || v.includes('?') || v.includes('#')) return false
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return false
  return true
}

function parseLoginUrl(v) {
  if (typeof v !== 'string') throw new Error('loginUrl must be a string')
  let u
  try {
    u = new URL(v)
  } catch {
    throw new Error('loginUrl must be a valid URL')
  }
  if (u.protocol !== 'https:') throw new Error('loginUrl must be https')
  if (u.username || u.password) throw new Error('loginUrl must not contain userinfo')
  if (u.search || u.hash) throw new Error('loginUrl must not contain query or fragment')
  if (isForbiddenHost(u.hostname)) throw new Error('loginUrl must be a public host')
  return u.toString()
}

// Validate and normalize a discovery payload object. Throws an Error naming the offending field.
export function validateDiscoveryPayload(raw) {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('payload must be a JSON object')
  }
  for (const k of Object.keys(raw)) {
    if (!PAYLOAD_KEYS.has(k)) throw new Error(`payload: unknown key "${k}"`)
  }
  if (raw.spec !== 'cpx-plugin/2') throw new Error('payload.spec must be "cpx-plugin/2"')
  if (!Number.isSafeInteger(raw.seq) || raw.seq < 1 || raw.seq > MAX_SEQ) {
    throw new Error('payload.seq must be an integer in 1..2^53-1')
  }
  if (
    !Array.isArray(raw.gateways) ||
    raw.gateways.length < 1 ||
    raw.gateways.length > MAX_GATEWAYS
  ) {
    throw new Error(`payload.gateways must list 1..${MAX_GATEWAYS} https origins`)
  }
  const gateways = []
  for (const g of raw.gateways) {
    const origin = parseOrigin(g)
    if (!origin) throw new Error(`payload.gateways: "${g}" is not a public https origin`)
    if (!gateways.includes(origin)) gateways.push(origin)
  }
  if (typeof raw.endpoints !== 'object' || raw.endpoints === null || Array.isArray(raw.endpoints)) {
    throw new Error('payload.endpoints must be an object')
  }
  const endpoints = {}
  for (const k of Object.keys(raw.endpoints)) {
    if (!REQUIRED_ENDPOINTS.includes(k) && !OPTIONAL_ENDPOINTS.has(k)) {
      throw new Error(`payload.endpoints: unknown endpoint "${k}"`)
    }
    if (!isValidEndpointPath(raw.endpoints[k])) {
      throw new Error(`payload.endpoints.${k} must be a relative path starting with "/"`)
    }
    endpoints[k] = raw.endpoints[k]
  }
  for (const k of REQUIRED_ENDPOINTS) {
    if (!(k in endpoints)) throw new Error(`payload.endpoints.${k} is required`)
  }
  const out = { spec: 'cpx-plugin/2', seq: raw.seq, gateways, endpoints }
  if (raw.loginUrl !== undefined) out.loginUrl = parseLoginUrl(raw.loginUrl)
  if (raw.discoveryUrls !== undefined) {
    if (!Array.isArray(raw.discoveryUrls) || raw.discoveryUrls.length > MAX_DISCOVERY_URLS) {
      throw new Error(
        `payload.discoveryUrls must be an array of at most ${MAX_DISCOVERY_URLS} origins`
      )
    }
    const loginOrigin = out.loginUrl ? new URL(out.loginUrl).origin : undefined
    const urls = []
    for (const d of raw.discoveryUrls) {
      const origin = parseOrigin(d)
      if (!origin) throw new Error(`payload.discoveryUrls: "${d}" is not a public https origin`)
      if (loginOrigin && origin === loginOrigin) {
        throw new Error('payload.discoveryUrls must not repeat the loginUrl origin')
      }
      if (urls.includes(origin))
        throw new Error('payload.discoveryUrls must not contain duplicates')
      urls.push(origin)
    }
    out.discoveryUrls = urls
  }
  return out
}

// Format checks of an envelope "<payloadB64>.<sigB64>" without verifying the signature (the
// server has no key material). Canonical base64 on both halves also rules out CR/LF and any
// other byte that would break the HTTP header the envelope is sent in.
export function parseDiscoveryEnvelope(text) {
  const signed = String(text).trim()
  const parts = signed.split('.')
  if (parts.length !== 2) throw new Error('envelope must contain exactly one "."')
  const [payloadB64, sigB64] = parts
  if (!isCanonicalB64(payloadB64) || !isCanonicalB64(sigB64)) {
    throw new Error('envelope: both halves must be canonical standard base64')
  }
  const payloadBytes = Buffer.from(payloadB64, 'base64')
  if (payloadBytes.length < 1 || payloadBytes.length > DISCOVERY_MAX_PAYLOAD_BYTES) {
    throw new Error(`envelope: payload must be 1..${DISCOVERY_MAX_PAYLOAD_BYTES} bytes`)
  }
  if (Buffer.from(sigB64, 'base64').length !== 64) {
    throw new Error('envelope: signature must be 64 bytes')
  }
  let payload
  try {
    payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(payloadBytes))
  } catch {
    throw new Error('envelope: payload is not valid UTF-8 JSON')
  }
  return { signed, payload: validateDiscoveryPayload(payload) }
}
