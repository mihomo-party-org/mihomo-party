import { readFileSync } from 'fs'
import { join } from 'path'
import { createPrivateKey, sign } from 'crypto'
import { describe, it, expect } from 'vitest'
import { buildDiscoverySignInput, checkSeq, parseSigned } from './discovery-sig'

interface Vector {
  name: string
  seedB64: string
  pubKeyB64: string
  payloadJson: string
  payloadB64: string
  signInputHex: string
  sigB64: string
  signed: string
  digestHex: string
}
const vectors: Vector[] = JSON.parse(
  readFileSync(join(__dirname, '__fixtures__', 'discovery-vectors.json'), 'utf-8')
)
const V = vectors[0]
const PKCS8 = Buffer.from('302e020100300506032b657004220420', 'hex')
function signWith(seedB64: string, payload: string | Buffer, prefix = true): string {
  const bytes = Buffer.isBuffer(payload) ? payload : Buffer.from(payload, 'utf-8')
  const key = createPrivateKey({
    key: Buffer.concat([PKCS8, Buffer.from(seedB64, 'base64')]),
    format: 'der',
    type: 'pkcs8'
  })
  const input = prefix ? buildDiscoverySignInput(bytes) : bytes
  return `${bytes.toString('base64')}.${sign(null, input, key).toString('base64')}`
}
const base = (): Record<string, unknown> => JSON.parse(V.payloadJson)
const envelope = (payload: Record<string, unknown>): string =>
  signWith(V.seedB64, JSON.stringify(payload))

describe('parseSigned', () => {
  it('accepts the recorded vectors and reproduces their digests', () => {
    for (const v of vectors) {
      const { payload, digest } = parseSigned(v.signed, v.pubKeyB64)
      expect(payload).toEqual(JSON.parse(v.payloadJson))
      expect(digest).toBe(v.digestHex)
    }
  })
  it('rejects a tampered payload byte', () => {
    const [p, sig] = V.signed.split('.')
    const bytes = Buffer.from(p, 'base64')
    bytes[bytes.length - 2] ^= 0x01
    expect(() => parseSigned(`${bytes.toString('base64')}.${sig}`, V.pubKeyB64)).toThrow(
      /signature/
    )
  })
  it('rejects a signature made under a different key', () => {
    expect(() => parseSigned(signWith(vectors[1].seedB64, V.payloadJson), V.pubKeyB64)).toThrow(
      /signature/
    )
  })
  it('rejects missing or extra dots', () => {
    expect(() => parseSigned(V.payloadB64, V.pubKeyB64)).toThrow(/"\."/)
    expect(() => parseSigned(`${V.signed}.x`, V.pubKeyB64)).toThrow(/"\."/)
  })
  it('rejects non-canonical base64 (missing padding, extra chars)', () => {
    const [p, sig] = V.signed.split('.')
    expect(() => parseSigned(`${p.replace(/=+$/, '')}.${sig}`, V.pubKeyB64)).toThrow(/canonical/)
    expect(() => parseSigned(`${p}.${sig}!`, V.pubKeyB64)).toThrow(/canonical/)
  })
  it('rejects a 63-byte signature', () => {
    const [p] = V.signed.split('.')
    expect(() =>
      parseSigned(`${p}.${Buffer.alloc(63, 1).toString('base64')}`, V.pubKeyB64)
    ).toThrow(/64 bytes/)
  })
  it('rejects a payload larger than 4 KiB', () => {
    const big = { ...base(), loginUrl: 'https://panel.example.com/' + 'a'.repeat(4100) }
    expect(() => parseSigned(envelope(big), V.pubKeyB64)).toThrow(/bytes/)
  })
  it('rejects unknown keys', () => {
    expect(() => parseSigned(envelope({ ...base(), extra: 1 }), V.pubKeyB64)).toThrow(/unknown/)
    expect(() =>
      parseSigned(
        envelope({ ...base(), endpoints: { ...(base().endpoints as object), x: '/x' } }),
        V.pubKeyB64
      )
    ).toThrow(/unknown endpoint/)
  })
  it('rejects seq that is not an integer in 1..2^53-1', () => {
    for (const seq of [0, 1.5, -1, 2 ** 53, '12']) {
      expect(() => parseSigned(envelope({ ...base(), seq }), V.pubKeyB64)).toThrow(/seq/)
    }
    expect(parseSigned(envelope({ ...base(), seq: 2 ** 53 - 1 }), V.pubKeyB64).payload.seq).toBe(
      2 ** 53 - 1
    )
  })
  it('ISS-014: rejects a payload that is not valid UTF-8 even when the signature verifies', () => {
    const good = Buffer.from(JSON.stringify(base()), 'utf-8')
    const idx = good.indexOf(Buffer.from('/enroll'))
    const bad = Buffer.concat([
      good.subarray(0, idx + 1),
      Buffer.from([0xc0]),
      good.subarray(idx + 1)
    ])
    expect(() => parseSigned(signWith(V.seedB64, bad), V.pubKeyB64)).toThrow(/UTF-8/)
  })
  it('rejects a signature without the domain-separation prefix', () => {
    expect(() => parseSigned(signWith(V.seedB64, V.payloadJson, false), V.pubKeyB64)).toThrow(
      /signature/
    )
  })
  it('accepts an optional bootstrap endpoint and validates loginUrl / discoveryUrls format', () => {
    const ok = envelope({
      ...base(),
      endpoints: { ...(base().endpoints as object), bootstrap: '/bootstrap' }
    })
    expect(parseSigned(ok, V.pubKeyB64).payload.endpoints).not.toHaveProperty('bootstrap')
    expect(() =>
      parseSigned(envelope({ ...base(), loginUrl: 'http://panel.example.com/a' }), V.pubKeyB64)
    ).toThrow(/loginUrl/)
    expect(() =>
      parseSigned(envelope({ ...base(), discoveryUrls: ['https://x/', 'https://x'] }), V.pubKeyB64)
    ).toThrow(/duplicates/)
    expect(
      parseSigned(envelope({ ...base(), discoveryUrls: [] }), V.pubKeyB64).payload.discoveryUrls
    ).toEqual([])
    const { discoveryUrls: _d, ...noUrls } = base()
    expect(parseSigned(envelope(noUrls), V.pubKeyB64).payload.discoveryUrls).toBeUndefined()
  })
})

describe('checkSeq (§5.3)', () => {
  const signer = (minSeq?: number, currentDigest?: string): DiscoverySigner => ({
    pubKeyB64: V.pubKeyB64,
    minSeq,
    currentDigest
  })
  it('accepts anything when nothing is stored', () => {
    expect(checkSeq(1, 'x', signer())).toBe('accept')
  })
  it('accepts higher, aligns equal+same digest, rejects equal+different digest and lower', () => {
    expect(checkSeq(13, 'x', signer(12, 'd'))).toBe('accept')
    expect(checkSeq(12, 'd', signer(12, 'd'))).toBe('align')
    expect(checkSeq(12, 'e', signer(12, 'd'))).toBe('equivocation')
    expect(checkSeq(11, 'x', signer(12, 'd'))).toBe('rollback')
  })
})
