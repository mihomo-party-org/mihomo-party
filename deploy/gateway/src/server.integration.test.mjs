import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import {
  generateKeyPairSync,
  randomUUID,
  randomBytes,
  createHash,
  sign as edSign
} from 'node:crypto'
import { openDb } from './db.mjs'
import { createCodeStore } from './codes.mjs'
import { createNonceStore } from './nonces.mjs'
import { createRateLimiter } from './ratelimit.mjs'
import { hashPassword, buildSignInput, OP_CONFIG, OP_REVOKE } from './crypto.mjs'
import { createServer } from './server.mjs'

const CLASH = 'proxies:\n  - {name: a, type: ss}\n'
const REDIRECT = 'http://127.0.0.1:51000/callback'

let server
let base

before(async () => {
  const db = openDb(':memory:')
  db.addUser({
    username: 'alice',
    pwdHash: hashPassword('pw'),
    subUrl: 'https://o/sub',
    deviceLimit: 3
  })
  const deps = {
    db,
    codes: createCodeStore(),
    nonces: createNonceStore(),
    rateLimiter: createRateLimiter({ max: 100, windowMs: 1000 }),
    fetchSubscription: async () => CLASH,
    // §5a: a pre-signed envelope; the integration test only checks plumbing, the crypto tests verify it
    discovery: {
      signed: 'cGF5bG9hZA==.c2ln',
      payload: { spec: 'cpx-plugin/2', seq: 1, gateways: ['https://gw.test', 'https://gw2.test'] }
    },
    config: {
      publicOrigin: 'https://gw.test',
      gatewayOrigins: ['https://gw.test', 'https://gw2.test'],
      clockSkewMs: 300000,
      retired: false,
      subTimeoutMs: 5000,
      subMaxBytes: 4096
    }
  }
  server = createServer(deps)
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${server.address().port}`
})
after(() => server.close())

function request(method, path, { json, form } = {}) {
  return new Promise((resolve, reject) => {
    let body
    const headers = {}
    if (json !== undefined) {
      body = JSON.stringify(json)
      headers['content-type'] = 'application/json'
    } else if (form !== undefined) {
      body = new URLSearchParams(form).toString()
      headers['content-type'] = 'application/x-www-form-urlencoded'
    }
    const req = http.request(new URL(path, base), { method, headers }, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () =>
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf-8')
        })
      )
    })
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

function newDevice() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  const pubKey = Buffer.from(publicKey.export({ format: 'jwk' }).x, 'base64url').toString('base64')
  return {
    deviceId: randomUUID(),
    pubKey,
    sign: (i) => edSign(null, i, privateKey).toString('base64')
  }
}

async function signedConfigBody(deviceId, sign, op) {
  const ch = JSON.parse((await request('POST', '/challenge', { json: { deviceId } })).body)
  const ts = Date.now()
  const input = buildSignInput(op, deviceId, ch.nonceId, Buffer.from(ch.nonce, 'base64'), ts)
  return { deviceId, nonceId: ch.nonceId, nonce: ch.nonce, ts, sig: sign(input) }
}

test('full flow: well-known → authorize → enroll → challenge → config → revoke', async () => {
  // 1. discovery
  const wk = await request('GET', '/.well-known/cpx-gateway')
  assert.equal(wk.status, 200)
  const wkBody = JSON.parse(wk.body)
  assert.equal(wkBody.gateway, 'https://gw.test')
  assert.deepEqual(wkBody.gateways, ['https://gw.test', 'https://gw2.test'])
  assert.equal(wkBody.gateway, wkBody.gateways[0])
  assert.equal(wkBody.endpoints.config, '/config')
  assert.equal(wkBody.signed, 'cGF5bG9hZA==.c2ln')

  // 2. PKCE login params
  const verifier = randomBytes(32).toString('base64url')
  const challengeParam = createHash('sha256').update(verifier).digest('base64url')
  const params = {
    response_type: 'code',
    client_id: 'mihomo-party',
    redirect_uri: REDIRECT,
    code_challenge: challengeParam,
    code_challenge_method: 'S256',
    state: 'st-1',
    scope: 'subscribe'
  }

  // authorize GET renders a form
  const getForm = await request('GET', '/oauth/authorize?' + new URLSearchParams(params))
  assert.equal(getForm.status, 200)
  assert.match(getForm.body, /<form/i)

  // authorize POST logs in → 302 with code
  const login = await request('POST', '/oauth/authorize', {
    form: { ...params, username: 'alice', password: 'pw' }
  })
  assert.equal(login.status, 302)
  const loc = new URL(login.headers.location)
  assert.equal(loc.searchParams.get('state'), 'st-1')
  const code = loc.searchParams.get('code')
  assert.ok(code)

  // 3. enroll
  const dev = newDevice()
  const enrollRes = await request('POST', '/enroll', {
    json: {
      code,
      code_verifier: verifier,
      redirect_uri: REDIRECT,
      client_id: 'mihomo-party',
      devicePubKey: dev.pubKey,
      deviceId: dev.deviceId
    }
  })
  assert.equal(enrollRes.status, 200)
  assert.deepEqual(JSON.parse(enrollRes.body), { ok: true })

  // 4. config (challenge → sign → fetch)
  const cfgBody = await signedConfigBody(dev.deviceId, dev.sign, OP_CONFIG)
  const cfg = await request('POST', '/config', { json: cfgBody })
  assert.equal(cfg.status, 200)
  assert.match(cfg.headers['content-type'], /yaml/)
  assert.equal(cfg.body, CLASH)

  // 5. revoke, then a challenge must report the device as revoked
  const revBody = await signedConfigBody(dev.deviceId, dev.sign, OP_REVOKE)
  const rev = await request('POST', '/revoke', { json: revBody })
  assert.equal(rev.status, 200)
  const after = await request('POST', '/challenge', { json: { deviceId: dev.deviceId } })
  assert.equal(after.status, 403)
  assert.equal(JSON.parse(after.body).error, 'device_revoked')
})

test('a re-used authorization code cannot enroll twice', async () => {
  const verifier = randomBytes(32).toString('base64url')
  const challengeParam = createHash('sha256').update(verifier).digest('base64url')
  const params = {
    response_type: 'code',
    client_id: 'mihomo-party',
    redirect_uri: REDIRECT,
    code_challenge: challengeParam,
    code_challenge_method: 'S256',
    state: 's',
    scope: 'subscribe'
  }
  const login = await request('POST', '/oauth/authorize', {
    form: { ...params, username: 'alice', password: 'pw' }
  })
  const code = new URL(login.headers.location).searchParams.get('code')
  const enrollOnce = (deviceId, pubKey) =>
    request('POST', '/enroll', {
      json: {
        code,
        code_verifier: verifier,
        redirect_uri: REDIRECT,
        client_id: 'mihomo-party',
        devicePubKey: pubKey,
        deviceId
      }
    })

  const d1 = newDevice()
  assert.equal((await enrollOnce(d1.deviceId, d1.pubKey)).status, 200)
  const d2 = newDevice()
  const second = await enrollOnce(d2.deviceId, d2.pubKey)
  assert.equal(second.status, 400)
  assert.equal(JSON.parse(second.body).error, 'invalid_code')
})
