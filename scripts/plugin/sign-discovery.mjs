// Offline signer for the CPX v2 signed discovery document (integration guide §5a).
//
// Usage:
//   node scripts/plugin/sign-discovery.mjs <payload.json> [--seed-file <path>] [--out <envelope.txt>]
//
// The Ed25519 seed (32 raw bytes, standard base64) is read from --seed-file or, when omitted, from
// stdin — never from the command line. Keep the seed offline; the gateway process only needs the
// resulting envelope file (DISCOVERY_SIGNED_FILE). Prints "<payloadB64>.<sigB64>" and the public key.
//
// The payload file is parsed and re-serialized compactly; the signature covers exactly those bytes
// (prefix "CPX2-DISCOVERY\0" || payloadBytes). No canonicalization is needed on either side.
import { readFileSync, writeFileSync } from 'fs'
import { createPrivateKey, createPublicKey, sign } from 'crypto'
import { validateDiscoveryPayload } from '../../deploy/gateway/src/discovery.mjs'

const ED25519_PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex')
const PREFIX = Buffer.from('CPX2-DISCOVERY\u0000', 'utf-8')
const MAX_PAYLOAD_BYTES = 4096

function die(msg) {
  console.error(msg)
  process.exit(1)
}

function keyFromSeed(seed) {
  return createPrivateKey({
    key: Buffer.concat([ED25519_PKCS8_PREFIX, seed]),
    format: 'der',
    type: 'pkcs8'
  })
}

function signDiscovery(payloadObject, seed) {
  const payloadBytes = Buffer.from(JSON.stringify(payloadObject), 'utf-8')
  if (payloadBytes.length > MAX_PAYLOAD_BYTES) {
    throw new Error(`payload is ${payloadBytes.length} bytes; the limit is ${MAX_PAYLOAD_BYTES}`)
  }
  const priv = keyFromSeed(seed)
  const sig = sign(null, Buffer.concat([PREFIX, payloadBytes]), priv)
  const pub = Buffer.from(createPublicKey(priv).export({ format: 'jwk' }).x, 'base64url')
  return {
    signed: `${payloadBytes.toString('base64')}.${sig.toString('base64')}`,
    pubKeyB64: pub.toString('base64')
  }
}

const args = process.argv.slice(2)
let payloadPath
let seedFile
let outFile
for (let i = 0; i < args.length; i++) {
  const a = args[i]
  if (a === '--seed-file') seedFile = args[++i]
  else if (a === '--out') outFile = args[++i]
  else if (!payloadPath) payloadPath = a
  else die(`unexpected argument: ${a}`)
}
if (!payloadPath) {
  die('Usage: node sign-discovery.mjs <payload.json> [--seed-file <path>] [--out <envelope.txt>]')
}

const seedText = (seedFile ? readFileSync(seedFile, 'utf-8') : readFileSync(0, 'utf-8')).trim()
const seed = Buffer.from(seedText, 'base64')
if (seed.length !== 32 || seed.toString('base64') !== seedText) {
  die('seed must be 32 raw bytes in standard base64 (with padding)')
}

let payload
try {
  payload = JSON.parse(readFileSync(payloadPath, 'utf-8'))
} catch (e) {
  die(`cannot parse ${payloadPath}: ${e.message}`)
}
// Same field rules as the client (discovery-sig.ts): fail here rather than after publication.
try {
  payload = validateDiscoveryPayload(payload)
} catch (e) {
  die(e.message)
}

let result
try {
  result = signDiscovery(payload, seed)
} catch (e) {
  die(e.message)
}
if (outFile) writeFileSync(outFile, result.signed + '\n')
console.log(result.signed)
console.error(`public key (providerPubKey): ${result.pubKeyB64}`)
