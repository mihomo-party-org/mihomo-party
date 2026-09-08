import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  isForbiddenHost,
  parseOrigin,
  validateDiscoveryPayload,
  parseDiscoveryEnvelope
} from './discovery.mjs'
import { signDiscovery } from './crypto.mjs'

const GOOD = {
  spec: 'cpx-plugin/2',
  seq: 12,
  gateways: ['https://gw1.example.net/', 'https://gw2-cdn.example.com'],
  endpoints: { enroll: '/enroll', challenge: '/challenge', config: '/config', revoke: '/revoke' },
  loginUrl: 'https://panel-new.example.com/oauth/authorize',
  discoveryUrls: ['https://gw2-cdn.example.com']
}

test('validateDiscoveryPayload accepts and normalizes a well-formed document', () => {
  const out = validateDiscoveryPayload(GOOD)
  assert.deepEqual(out.gateways, ['https://gw1.example.net', 'https://gw2-cdn.example.com'])
  assert.equal(out.seq, 12)
  assert.deepEqual(out.discoveryUrls, ['https://gw2-cdn.example.com'])
})

test('validateDiscoveryPayload rejects what the client rejects', () => {
  const cases = [
    [{ ...GOOD, extra: 1 }, /unknown key/],
    [{ ...GOOD, seq: 0 }, /seq/],
    [{ ...GOOD, seq: 2 ** 53 }, /seq/],
    [{ ...GOOD, gateways: [] }, /gateways/],
    [{ ...GOOD, gateways: ['https://a', 'https://b', 'https://c', 'https://d'] }, /gateways/],
    [{ ...GOOD, gateways: ['https://10.0.0.1'] }, /public https origin/],
    [{ ...GOOD, gateways: ['https://localhost'] }, /public https origin/],
    [{ ...GOOD, gateways: ['https://[::1]'] }, /public https origin/],
    [{ ...GOOD, gateways: ['http://gw.example.net'] }, /public https origin/],
    [{ ...GOOD, gateways: ['https://gw.example.net/base'] }, /public https origin/],
    [{ ...GOOD, endpoints: { ...GOOD.endpoints, x: '/x' } }, /unknown endpoint/],
    [{ ...GOOD, endpoints: { ...GOOD.endpoints, config: 'config' } }, /endpoints.config/],
    [
      { ...GOOD, endpoints: { enroll: '/e', challenge: '/c', config: '/cfg' } },
      /revoke is required/
    ],
    [{ ...GOOD, loginUrl: 'http://panel.example.com/a' }, /loginUrl/],
    [{ ...GOOD, discoveryUrls: ['https://panel-new.example.com'] }, /loginUrl origin/],
    [{ ...GOOD, discoveryUrls: ['https://x.example', 'https://x.example/'] }, /duplicates/]
  ]
  for (const [payload, re] of cases) assert.throws(() => validateDiscoveryPayload(payload), re)
})

test('isForbiddenHost / parseOrigin mirror the client literal host rules', () => {
  for (const h of [
    'localhost',
    'foo.localhost',
    'localhost.',
    '127.0.0.1',
    '10.1.2.3',
    '169.254.169.254',
    '198.18.0.1',
    '[::1]',
    'fe80::1',
    'fd00::1',
    '::ffff:127.0.0.1',
    ''
  ]) {
    assert.equal(isForbiddenHost(h), true, h)
  }
  for (const h of ['gw.example.net', 'localhost.com', '1.1.1.1', '2606:4700::1']) {
    assert.equal(isForbiddenHost(h), false, h)
  }
  // R1: WHATWG URL normalizes mapped/compressed IPv6 into hex form; every special range the client
  // rejects must be rejected here as well, through parseOrigin (the path admin/server use)
  for (const bad of [
    'https://[::ffff:127.0.0.1]',
    'https://[::ffff:7f00:1]',
    'https://[::ffff:10.0.0.1]',
    'https://[100::1]',
    'https://[2002:7f00:1::1]',
    'https://[2001:db8::1]',
    'https://[ff02::1]',
    'https://[::]'
  ]) {
    assert.equal(parseOrigin(bad), null, bad)
  }
  assert.equal(parseOrigin('https://[2606:4700::1]'), 'https://[2606:4700::1]')
  assert.equal(parseOrigin('https://gw.example.net:8443/'), 'https://gw.example.net:8443')
  assert.equal(parseOrigin('https://u:p@gw.example.net'), null)
})

test('parseDiscoveryEnvelope enforces canonical base64, sizes and the payload rules', () => {
  const seed = Buffer.alloc(32, 7)
  const signed = signDiscovery(Buffer.from(JSON.stringify(GOOD)), seed)
  const parsed = parseDiscoveryEnvelope(signed + '\n')
  assert.equal(parsed.signed, signed)
  assert.deepEqual(parsed.payload.gateways, [
    'https://gw1.example.net',
    'https://gw2-cdn.example.com'
  ])
  const [p, sig] = signed.split('.')
  assert.throws(() => parseDiscoveryEnvelope(`${p}\r\n.${sig}`), /canonical/)
  assert.throws(() => parseDiscoveryEnvelope(`${p.replace(/=+$/, '')}.${sig}`), /canonical/)
  assert.throws(() => parseDiscoveryEnvelope(`${p}.${sig}.x`), /one "."/)
  assert.throws(
    () => parseDiscoveryEnvelope(`${p}.${Buffer.alloc(63).toString('base64')}`),
    /64 bytes/
  )
  const badPayload = signDiscovery(Buffer.from(JSON.stringify({ ...GOOD, extra: 1 })), seed)
  assert.throws(() => parseDiscoveryEnvelope(badPayload), /unknown key/)
})
