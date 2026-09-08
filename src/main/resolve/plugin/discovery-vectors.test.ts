import { readFileSync } from 'fs'
import { join } from 'path'
import { createPrivateKey, sign } from 'crypto'
import { describe, it, expect } from 'vitest'
import { verifyRequest } from './device'
import { buildDiscoverySignInput, parseSigned } from './discovery-sig'
import { sha256Hex } from './encoding'

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
const PKCS8 = Buffer.from('302e020100300506032b657004220420', 'hex')

describe('cross-language signed discovery vectors', () => {
  it('discovery-sig.ts reproduces each recorded sign input, signature, digest and envelope', () => {
    expect(vectors.length).toBeGreaterThan(0)
    for (const v of vectors) {
      const payloadBytes = Buffer.from(v.payloadJson, 'utf-8')
      expect(payloadBytes.toString('base64')).toBe(v.payloadB64)
      const input = buildDiscoverySignInput(payloadBytes)
      expect(input.toString('hex')).toBe(v.signInputHex)
      const key = createPrivateKey({
        key: Buffer.concat([PKCS8, Buffer.from(v.seedB64, 'base64')]),
        format: 'der',
        type: 'pkcs8'
      })
      expect(sign(null, input, key).toString('base64')).toBe(v.sigB64)
      expect(verifyRequest(v.pubKeyB64, input, v.sigB64)).toBe(true)
      expect(sha256Hex(payloadBytes)).toBe(v.digestHex)
      expect(`${v.payloadB64}.${v.sigB64}`).toBe(v.signed)
      const parsed = parseSigned(v.signed, v.pubKeyB64)
      expect(parsed.digest).toBe(v.digestHex)
      expect(parsed.payload).toEqual(JSON.parse(v.payloadJson))
    }
  })
})
