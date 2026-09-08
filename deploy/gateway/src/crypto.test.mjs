import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  OP_CONFIG,
  OP_REVOKE,
  hashPassword,
  verifyPassword,
  verifyPkce,
  buildSignInput,
  verifySignature
} from './crypto.mjs'

// One recorded cross-language vector (mirrors the client's sign-vectors.json fixture).
const VEC = {
  op: 1,
  deviceId: '11111111-1111-4111-8111-111111111111',
  nonceId: 'nonce-1',
  pubKeyB64: 'iojj3XQJ8ZX9UtstPLpdcspnCb8dlBIb83SIAbQPb1w=',
  nonceB64: 'qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqo=',
  ts: 1700000000000,
  inputHex:
    '43505832012431313131313131312d313131312d343131312d383131312d313131313131313131313131076e6f6e63652d31aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa0000018bcfe56800',
  sigB64: 'to+fTc12+7n2enMcfUXeZRT4ro7KUQfvWe5GXQ+BzvLY1Baoo+9RFCMGVkkv0JH9pLMjKCb5ViBRzQ9pFe12Cg=='
}

test('op constants match the wire protocol', () => {
  assert.equal(OP_CONFIG, 1)
  assert.equal(OP_REVOKE, 2)
})

test('hashPassword/verifyPassword round-trips and rejects wrong password', () => {
  const stored = hashPassword('s3cret-pw')
  assert.match(stored, /^scrypt\$\d+\$\d+\$\d+\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/)
  assert.equal(verifyPassword('s3cret-pw', stored), true)
  assert.equal(verifyPassword('wrong', stored), false)
})

test('verifyPassword returns false on a malformed stored hash', () => {
  assert.equal(verifyPassword('x', 'not-a-hash'), false)
  assert.equal(verifyPassword('x', ''), false)
})

test('verifyPkce accepts BASE64URL(SHA256(verifier)) and rejects mismatch', () => {
  const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  assert.equal(verifyPkce(verifier, challenge), true)
  assert.equal(verifyPkce(verifier, challenge + 'x'), false)
  assert.equal(verifyPkce('different', challenge), false)
})

test('buildSignInput reproduces the recorded canonical byte string', () => {
  const nonce = Buffer.from(VEC.nonceB64, 'base64')
  const input = buildSignInput(VEC.op, VEC.deviceId, VEC.nonceId, nonce, VEC.ts)
  assert.equal(input.toString('hex'), VEC.inputHex)
})

test('verifySignature accepts the recorded signature and rejects tampering', () => {
  const nonce = Buffer.from(VEC.nonceB64, 'base64')
  const input = buildSignInput(VEC.op, VEC.deviceId, VEC.nonceId, nonce, VEC.ts)
  assert.equal(verifySignature(VEC.pubKeyB64, input, VEC.sigB64), true)

  const tampered = buildSignInput(OP_REVOKE, VEC.deviceId, VEC.nonceId, nonce, VEC.ts)
  assert.equal(verifySignature(VEC.pubKeyB64, tampered, VEC.sigB64), false)
})

test('verifySignature returns false on a garbage signature instead of throwing', () => {
  const nonce = Buffer.from(VEC.nonceB64, 'base64')
  const input = buildSignInput(VEC.op, VEC.deviceId, VEC.nonceId, nonce, VEC.ts)
  assert.equal(verifySignature(VEC.pubKeyB64, input, 'not-base64-!!!'), false)
  assert.equal(verifySignature('bad-pubkey', input, VEC.sigB64), false)
})

// ---------- §5a signed discovery: interop with the client vectors ----------
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  signDiscovery,
  verifyDiscoveryEnvelope,
  pubKeyFromSeed,
  DISCOVERY_SIGN_PREFIX
} from './crypto.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const discoveryVectors = JSON.parse(
  readFileSync(
    join(here, '../../../src/main/resolve/plugin/__fixtures__/discovery-vectors.json'),
    'utf-8'
  )
)

test('gateway crypto reproduces the client discovery vectors byte-for-byte', () => {
  assert.ok(discoveryVectors.length > 0)
  assert.equal(
    DISCOVERY_SIGN_PREFIX.toString('hex'),
    Buffer.from('CPX2-DISCOVERY\u0000').toString('hex')
  )
  for (const v of discoveryVectors) {
    const seed = Buffer.from(v.seedB64, 'base64')
    assert.equal(pubKeyFromSeed(seed), v.pubKeyB64)
    const payloadBytes = Buffer.from(v.payloadJson, 'utf-8')
    assert.equal(signDiscovery(payloadBytes, seed), v.signed)
    const back = verifyDiscoveryEnvelope(v.signed, v.pubKeyB64)
    assert.equal(back.toString('utf-8'), v.payloadJson)
    assert.equal(createHash('sha256').update(back).digest('hex'), v.digestHex)
  }
})

test('verifyDiscoveryEnvelope rejects tampering, wrong key, bad format', () => {
  const v = discoveryVectors[0]
  const [p, sig] = v.signed.split('.')
  assert.throws(() => verifyDiscoveryEnvelope(`${p}.${sig}.x`, v.pubKeyB64), /"\."/)
  assert.throws(
    () => verifyDiscoveryEnvelope(`${p.replace(/=+$/, '')}.${sig}`, v.pubKeyB64),
    /canonical/
  )
  const bad = Buffer.from(sig, 'base64')
  bad[3] ^= 1
  assert.throws(
    () => verifyDiscoveryEnvelope(`${p}.${bad.toString('base64')}`, v.pubKeyB64),
    /verification/
  )
  assert.throws(
    () => verifyDiscoveryEnvelope(v.signed, discoveryVectors[1].pubKeyB64),
    /verification/
  )
})
