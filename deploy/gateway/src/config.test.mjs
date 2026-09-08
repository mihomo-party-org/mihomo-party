import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadConfig, parseGatewayOrigins } from './config.mjs'
import { parseMessages, parseDiscoverySigned } from './server.mjs'

test('applies sane defaults for an empty environment', () => {
  const c = loadConfig({})
  assert.equal(c.port, 8080)
  assert.equal(c.dbPath, '/data/gateway.db')
  assert.equal(c.deviceLimitDefault, 3)
  assert.equal(c.codeTtlMs, 60000)
  assert.equal(c.nonceTtlMs, 60000)
  assert.equal(c.noncePoolMax, 8)
  assert.equal(c.clockSkewMs, 300000)
  assert.equal(c.subMaxBytes, 10485760)
  assert.equal(c.retired, false)
})

test('parses numeric overrides as numbers', () => {
  const c = loadConfig({ PORT: '9000', CLOCK_SKEW_MS: '120000', NONCE_POOL_MAX: '4' })
  assert.strictEqual(c.port, 9000)
  assert.strictEqual(c.clockSkewMs, 120000)
  assert.strictEqual(c.noncePoolMax, 4)
})

test('RETIRED is true only for the literal "true"', () => {
  assert.equal(loadConfig({ RETIRED: 'true' }).retired, true)
  assert.equal(loadConfig({ RETIRED: 'false' }).retired, false)
  assert.equal(loadConfig({ RETIRED: '1' }).retired, false)
})

test('derives publicOrigin from DOMAIN when PUBLIC_ORIGIN is unset', () => {
  assert.equal(loadConfig({ DOMAIN: 'gw.example.com' }).publicOrigin, 'https://gw.example.com')
  assert.equal(
    loadConfig({ DOMAIN: 'gw.example.com', PUBLIC_ORIGIN: 'https://other.example' }).publicOrigin,
    'https://other.example'
  )
})

test('the returned config object is frozen', () => {
  const c = loadConfig({})
  assert.throws(() => {
    c.port = 1
  })
})

test('gatewayOrigins falls back to [PUBLIC_ORIGIN] when GATEWAY_ORIGINS is unset', () => {
  assert.deepEqual(loadConfig({ DOMAIN: 'gw.example.com' }).gatewayOrigins, [
    'https://gw.example.com'
  ])
  assert.deepEqual(loadConfig({ PUBLIC_ORIGIN: 'https://other.example' }).gatewayOrigins, [
    'https://other.example'
  ])
})

test('GATEWAY_ORIGINS parses a comma list of 1..3 origins, normalized and deduplicated', () => {
  const c = loadConfig({
    DOMAIN: 'a.example',
    GATEWAY_ORIGINS: ' https://a.example/, https://b-cdn.example ,https://a.example'
  })
  assert.deepEqual(c.gatewayOrigins, ['https://a.example', 'https://b-cdn.example'])
})

test('DOMAINS (comma list) derives publicOrigin from its first entry', () => {
  const c = loadConfig({ DOMAINS: 'a.example,b.example' })
  assert.equal(c.publicOrigin, 'https://a.example')
  assert.deepEqual(c.gatewayOrigins, ['https://a.example'])
})

test('GATEWAY_ORIGINS rejects private / loopback origins the client would refuse (R2-ISS-016)', () => {
  assert.throws(() => parseGatewayOrigins('https://127.0.0.1', 'https://x'), /public/)
  assert.throws(
    () => parseGatewayOrigins('https://a.example,https://gw.localhost', 'https://x'),
    /public/
  )
  assert.throws(() => parseGatewayOrigins('https://[::1]', 'https://x'), /public/)
  // the PUBLIC_ORIGIN fallback keeps accepting a dev default such as https://localhost
  assert.deepEqual(parseGatewayOrigins('', 'https://localhost'), ['https://localhost'])
})

test('GATEWAY_ORIGINS rejects non-https, paths, and more than 3 entries', () => {
  assert.throws(() => parseGatewayOrigins('http://a.example', 'https://x'), /https/)
  assert.throws(() => parseGatewayOrigins('https://a.example/base', 'https://x'), /path/)
  assert.throws(
    () => parseGatewayOrigins('https://a.x,https://b.x,https://c.x,https://d.x', 'https://x'),
    /1\.\.3/
  )
})

test('MESSAGES_FILE path is exposed; parseMessages keeps only the three known string keys', () => {
  assert.equal(
    loadConfig({ MESSAGES_FILE: '/etc/cpx/messages.json' }).messagesFile,
    '/etc/cpx/messages.json'
  )
  assert.deepEqual(
    parseMessages(
      JSON.stringify({
        device_revoked: ' expired ',
        device_limit: 7,
        extra: 'x',
        gateway_retired: ''
      })
    ),
    { device_revoked: 'expired' }
  )
  assert.throws(() => parseMessages('nope'), /valid JSON/)
  assert.throws(() => parseMessages('[]'), /object/)
})

test('DISCOVERY_SIGNED_FILE is exposed; parseDiscoverySigned decodes the payload and checks endpoints', () => {
  assert.equal(
    loadConfig({ DISCOVERY_SIGNED_FILE: '/data/discovery.signed' }).discoverySignedFile,
    '/data/discovery.signed'
  )
  const payload = {
    spec: 'cpx-plugin/2',
    seq: 5,
    gateways: ['https://a.example', 'https://b.example'],
    endpoints: { enroll: '/enroll', challenge: '/challenge', config: '/config', revoke: '/revoke' }
  }
  const sig = Buffer.alloc(64, 1).toString('base64')
  const signed = Buffer.from(JSON.stringify(payload)).toString('base64') + '.' + sig
  const parsed = parseDiscoverySigned(signed + '\n')
  assert.equal(parsed.signed, signed)
  assert.deepEqual(parsed.payload.gateways, payload.gateways)
  assert.throws(() => parseDiscoverySigned('nodot'), /one "\."/)
  const wrongPath = { ...payload, endpoints: { ...payload.endpoints, config: '/cfg' } }
  assert.throws(
    () =>
      parseDiscoverySigned(Buffer.from(JSON.stringify(wrongPath)).toString('base64') + '.' + sig),
    /endpoints\.config/
  )
  // ISS-019: a file with CR/LF or non-canonical base64 is refused at startup instead of breaking
  // every /config response's writeHead
  assert.throws(() => parseDiscoverySigned(signed.replace('.', '\r\n.')), /canonical/)
  assert.throws(() => parseDiscoverySigned(signed.slice(0, -1) + '.' + sig), /canonical|one/)
})
