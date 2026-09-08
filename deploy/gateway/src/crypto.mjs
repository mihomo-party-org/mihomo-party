// Crypto primitives for the gateway. Native node:crypto only — no dependencies.
// buildSignInput + verifySignature are byte-identical to the client's device.ts so
// signatures produced by the app verify here (see check-vectors.mjs for the proof).
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  randomBytes,
  scryptSync,
  sign,
  timingSafeEqual,
  verify
} from 'node:crypto'

export const OP_CONFIG = 1
export const OP_REVOKE = 2

const SCRYPT_N = 16384
const SCRYPT_R = 8
const SCRYPT_P = 1
const KEYLEN = 32

// "scrypt$N$r$p$saltB64$hashB64" — self-describing so params can change without breaking old hashes.
export function hashPassword(plain) {
  const salt = randomBytes(16)
  const hash = scryptSync(plain, salt, KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P })
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('base64')}$${hash.toString('base64')}`
}

export function verifyPassword(plain, stored) {
  try {
    const parts = String(stored).split('$')
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false
    const [, n, r, p, saltB64, hashB64] = parts
    const expected = Buffer.from(hashB64, 'base64')
    const actual = scryptSync(plain, Buffer.from(saltB64, 'base64'), expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p)
    })
    return actual.length === expected.length && timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

// PKCE S256: BASE64URL(SHA256(verifier)) === code_challenge (constant-time compare).
export function verifyPkce(verifier, challenge) {
  try {
    const computed = Buffer.from(createHash('sha256').update(String(verifier)).digest('base64url'))
    const given = Buffer.from(String(challenge))
    return computed.length === given.length && timingSafeEqual(computed, given)
  } catch {
    return false
  }
}

// Canonical sign-input (client v2 design §7): "CPX2" | u8 op | u8 len+deviceId | u8 len+nonceId | 32B nonce | u64be ts
export function buildSignInput(op, deviceId, nonceId, nonce, ts) {
  const did = Buffer.from(deviceId, 'utf-8')
  const nid = Buffer.from(nonceId, 'utf-8')
  if (did.length > 255 || nid.length > 255) throw new Error('deviceId/nonceId too long')
  const tsB = Buffer.alloc(8)
  tsB.writeBigUInt64BE(BigInt(ts))
  return Buffer.concat([
    Buffer.from('CPX2', 'ascii'),
    Buffer.from([op & 0xff]),
    Buffer.from([did.length]),
    did,
    Buffer.from([nid.length]),
    nid,
    nonce,
    tsB
  ])
}

// ---- Signed discovery document (client design §5a) ----
// Domain-separation prefix: "CPX2-DISCOVERY" followed by a NUL byte, then the exact payload bytes.
export const DISCOVERY_SIGN_PREFIX = Buffer.from('CPX2-DISCOVERY\u0000', 'utf-8')
export const DISCOVERY_MAX_PAYLOAD_BYTES = 4096
const ED25519_PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex')

export function generateSeed() {
  return randomBytes(32)
}

function keyFromSeed(seed) {
  return createPrivateKey({
    key: Buffer.concat([ED25519_PKCS8_PREFIX, seed]),
    format: 'der',
    type: 'pkcs8'
  })
}

export function pubKeyFromSeed(seed) {
  const jwk = createPublicKey(keyFromSeed(seed)).export({ format: 'jwk' })
  return Buffer.from(jwk.x, 'base64url').toString('base64')
}

export function isCanonicalB64(s) {
  if (typeof s !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(s)) return false
  return Buffer.from(s, 'base64').toString('base64') === s
}

// Offline: sign the exact payload bytes and produce the envelope "<payloadB64>.<sigB64>".
export function signDiscovery(payloadBytes, seed) {
  if (payloadBytes.length < 1 || payloadBytes.length > DISCOVERY_MAX_PAYLOAD_BYTES) {
    throw new Error(`discovery payload must be 1..${DISCOVERY_MAX_PAYLOAD_BYTES} bytes`)
  }
  const sig = sign(null, Buffer.concat([DISCOVERY_SIGN_PREFIX, payloadBytes]), keyFromSeed(seed))
  return `${payloadBytes.toString('base64')}.${sig.toString('base64')}`
}

// Format checks + signature verification of an envelope; returns the payload bytes.
export function verifyDiscoveryEnvelope(signed, pubKeyB64) {
  if (typeof signed !== 'string') throw new Error('signed must be a string')
  const parts = signed.split('.')
  if (parts.length !== 2) throw new Error('signed must contain exactly one "."')
  const [payloadB64, sigB64] = parts
  if (!isCanonicalB64(payloadB64) || !isCanonicalB64(sigB64)) {
    throw new Error('signed: non-canonical base64')
  }
  const payloadBytes = Buffer.from(payloadB64, 'base64')
  if (payloadBytes.length < 1 || payloadBytes.length > DISCOVERY_MAX_PAYLOAD_BYTES) {
    throw new Error('signed: payload size out of range')
  }
  if (Buffer.from(sigB64, 'base64').length !== 64) throw new Error('signed: bad signature length')
  if (!verifySignature(pubKeyB64, Buffer.concat([DISCOVERY_SIGN_PREFIX, payloadBytes]), sigB64)) {
    throw new Error('signed: signature verification failed')
  }
  return payloadBytes
}

// Ed25519 verify. pubKey is the raw 32-byte point (standard base64), sig is raw 64 bytes (standard base64).
export function verifySignature(pubKeyB64, input, sigB64) {
  try {
    const raw = Buffer.from(pubKeyB64, 'base64')
    if (raw.length !== 32) return false
    const sig = Buffer.from(sigB64, 'base64')
    if (sig.length !== 64) return false
    const key = createPublicKey({
      key: { kty: 'OKP', crv: 'Ed25519', x: raw.toString('base64url') },
      format: 'jwk'
    })
    return verify(null, input, key, sig)
  } catch {
    return false
  }
}
