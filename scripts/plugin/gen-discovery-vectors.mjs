// Regenerates src/main/resolve/plugin/__fixtures__/discovery-vectors.json — cross-implementation
// vectors for the signed discovery document (integration guide §5a / §14). Deterministic seeds.
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createHash, createPrivateKey, createPublicKey, sign } from 'crypto'

const ED25519_PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex')
const PREFIX = Buffer.from('CPX2-DISCOVERY\u0000', 'utf-8')

function keyFromSeed(seed) {
  return createPrivateKey({
    key: Buffer.concat([ED25519_PKCS8_PREFIX, seed]),
    format: 'der',
    type: 'pkcs8'
  })
}

const cases = [
  {
    name: 'full payload (seq 12, two gateways, loginUrl + discoveryUrls)',
    seedByte: 7,
    payload: {
      spec: 'cpx-plugin/2',
      seq: 12,
      gateways: ['https://gw1.example.net', 'https://gw2-cdn.example.com'],
      endpoints: {
        enroll: '/enroll',
        challenge: '/challenge',
        config: '/config',
        revoke: '/revoke'
      },
      loginUrl: 'https://panel-new.example.com/oauth/authorize',
      discoveryUrls: ['https://gw2-cdn.example.com']
    }
  },
  {
    name: 'minimal payload (seq 1, single gateway)',
    seedByte: 8,
    payload: {
      spec: 'cpx-plugin/2',
      seq: 1,
      gateways: ['https://gw.example.net'],
      endpoints: {
        enroll: '/enroll',
        challenge: '/challenge',
        config: '/config',
        revoke: '/revoke'
      }
    }
  }
]

const out = cases.map((c) => {
  const seed = Buffer.alloc(32, c.seedByte)
  const priv = keyFromSeed(seed)
  const pub = Buffer.from(createPublicKey(priv).export({ format: 'jwk' }).x, 'base64url')
  const payloadBytes = Buffer.from(JSON.stringify(c.payload), 'utf-8')
  const input = Buffer.concat([PREFIX, payloadBytes])
  const sig = sign(null, input, priv)
  return {
    name: c.name,
    seedB64: seed.toString('base64'),
    pubKeyB64: pub.toString('base64'),
    payloadJson: payloadBytes.toString('utf-8'),
    payloadB64: payloadBytes.toString('base64'),
    signInputHex: input.toString('hex'),
    sigB64: sig.toString('base64'),
    signed: `${payloadBytes.toString('base64')}.${sig.toString('base64')}`,
    digestHex: createHash('sha256').update(payloadBytes).digest('hex')
  }
})

const here = dirname(fileURLToPath(import.meta.url))
const dest = join(here, '../../src/main/resolve/plugin/__fixtures__/discovery-vectors.json')
mkdirSync(dirname(dest), { recursive: true })
writeFileSync(dest, JSON.stringify(out, null, 2) + '\n')
console.log('wrote', dest)
