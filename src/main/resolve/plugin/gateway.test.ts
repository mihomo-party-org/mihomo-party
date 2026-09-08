import { describe, it, expect, vi, beforeEach } from 'vitest'

const requestOnce = vi.fn()
vi.mock('./http-client', () => ({ requestOnce: (...a: unknown[]) => requestOnce(...a) }))

import { enroll, challenge, fetchConfig, revoke, GatewayError } from './gateway'
import { generateDevice, buildSignInput, verifyRequest, OP_CONFIG, OP_REVOKE } from './device'

const TARGET = {
  gateway: 'https://gw.front.com',
  endpoints: { enroll: '/enroll', challenge: '/challenge', config: '/config', revoke: '/revoke' }
}
// RoutedRequester 适配：把 op 层的路由执行器直接接到被 mock 的 requestOnce 上
const NET = { request: (url: string, opts: unknown) => requestOnce(url, opts) }
const CLASH =
  'proxies:\n  - {name: a, type: ss, server: 1.1.1.1, port: 8388, cipher: aes-128-gcm, password: x}\n'

function jsonReply(body: unknown, status = 200): void {
  requestOnce.mockResolvedValueOnce({ status, headers: {}, body: JSON.stringify(body) })
}
function rawReply(body: string, status = 200): void {
  requestOnce.mockResolvedValueOnce({ status, headers: {}, body })
}
function lastBody(): any {
  const call = requestOnce.mock.calls[requestOnce.mock.calls.length - 1]
  return JSON.parse((call[1] as { body: string }).body)
}

beforeEach(() => requestOnce.mockReset())

describe('gateway.enroll', () => {
  it('posts code+verifier+redirect+client+pubKey+deviceId, resolves on ok', async () => {
    jsonReply({ ok: true })
    await enroll(
      TARGET,
      {
        code: 'C',
        code_verifier: 'V',
        redirect_uri: 'http://127.0.0.1:5/callback',
        client_id: 'mihomo-party',
        devicePubKey: 'PUB',
        deviceId: 'DID'
      },
      NET
    )
    expect(requestOnce).toHaveBeenCalledWith('https://gw.front.com/enroll', expect.any(Object))
    expect(lastBody()).toMatchObject({ code: 'C', code_verifier: 'V', deviceId: 'DID' })
  })
  it('maps explicit revoked to GatewayError(revoked)', async () => {
    jsonReply({ error: 'revoked' }, 403)
    await expect(enroll(TARGET, {} as never, NET)).rejects.toMatchObject({ kind: 'revoked' })
  })
})

describe('gateway.challenge', () => {
  it('returns nonceId/nonce/exp', async () => {
    jsonReply({ nonceId: 'N1', nonce: Buffer.alloc(32, 1).toString('base64'), exp: 60 })
    const c = await challenge(TARGET, 'DID', NET)
    expect(c.nonceId).toBe('N1')
    expect(Buffer.from(c.nonce, 'base64')).toHaveLength(32)
  })
  it('rejects a nonce that is not 32 bytes as transient', async () => {
    jsonReply({ nonceId: 'N1', nonce: Buffer.alloc(16, 1).toString('base64'), exp: 60 })
    await expect(challenge(TARGET, 'DID', NET)).rejects.toMatchObject({ kind: 'transient' })
  })
  it('rejects a non-base64 nonce as transient', async () => {
    jsonReply({ nonceId: 'N1', nonce: 'not base64 !!!', exp: 60 })
    await expect(challenge(TARGET, 'DID', NET)).rejects.toMatchObject({ kind: 'transient' })
  })
  it('rejects a nonceId with control/whitespace chars as transient', async () => {
    jsonReply({ nonceId: 'bad\nid', nonce: Buffer.alloc(32, 1).toString('base64'), exp: 60 })
    await expect(challenge(TARGET, 'DID', NET)).rejects.toMatchObject({ kind: 'transient' })
  })
})

describe('gateway.fetchConfig', () => {
  it('challenge→signed config; signature verifies against device pubkey; returns YAML', async () => {
    const dev = generateDevice()
    const nonceBuf = Buffer.alloc(32, 9)
    jsonReply({ nonceId: 'N1', nonce: nonceBuf.toString('base64'), exp: 60 })
    rawReply(CLASH)
    const { yaml, discovery } = await fetchConfig(
      TARGET,
      { deviceId: dev.deviceId, privKeyB64: dev.privKeyB64 },
      NET
    )
    expect(yaml).toBe(CLASH)
    expect(discovery).toBeUndefined()
    const body = lastBody()
    expect(body).toMatchObject({ deviceId: dev.deviceId, nonceId: 'N1' })
    const input = buildSignInput(OP_CONFIG, dev.deviceId, 'N1', nonceBuf, body.ts)
    expect(verifyRequest(dev.pubKeyB64, input, body.sig)).toBe(true)
  })
  it('rejects a non-clash config body as transient', async () => {
    const dev = generateDevice()
    jsonReply({ nonceId: 'N1', nonce: Buffer.alloc(32).toString('base64'), exp: 60 })
    rawReply('just text')
    await expect(
      fetchConfig(TARGET, { deviceId: dev.deviceId, privKeyB64: dev.privKeyB64 }, NET)
    ).rejects.toMatchObject({ kind: 'transient' })
  })
  it('maps 410 to GatewayError(retired)', async () => {
    const dev = generateDevice()
    jsonReply({ nonceId: 'N1', nonce: Buffer.alloc(32).toString('base64'), exp: 60 })
    rawReply('', 410)
    await expect(
      fetchConfig(TARGET, { deviceId: dev.deviceId, privKeyB64: dev.privKeyB64 }, NET)
    ).rejects.toMatchObject({ kind: 'retired' })
  })
  it('maps gateway_retired json marker to retired', async () => {
    const dev = generateDevice()
    jsonReply({ error: 'gateway_retired' }, 200)
    await expect(
      fetchConfig(TARGET, { deviceId: dev.deviceId, privKeyB64: dev.privKeyB64 }, NET)
    ).rejects.toMatchObject({ kind: 'retired' })
  })
  it('maps 5xx to transient', async () => {
    const dev = generateDevice()
    jsonReply({ nonceId: 'N1', nonce: Buffer.alloc(32).toString('base64'), exp: 60 })
    rawReply('', 503)
    await expect(
      fetchConfig(TARGET, { deviceId: dev.deviceId, privKeyB64: dev.privKeyB64 }, NET)
    ).rejects.toMatchObject({ kind: 'transient' })
  })
  it('maps a DNS failure (ENOTFOUND) to unreachable', async () => {
    const dev = generateDevice()
    requestOnce.mockRejectedValueOnce(
      Object.assign(new Error('getaddrinfo ENOTFOUND gw.front.com'), { code: 'ENOTFOUND' })
    )
    await expect(
      fetchConfig(TARGET, { deviceId: dev.deviceId, privKeyB64: dev.privKeyB64 }, NET)
    ).rejects.toMatchObject({ kind: 'unreachable' })
  })
  it('maps a connection refused (ECONNREFUSED) to unreachable', async () => {
    const dev = generateDevice()
    requestOnce.mockRejectedValueOnce(
      Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' })
    )
    await expect(
      fetchConfig(TARGET, { deviceId: dev.deviceId, privKeyB64: dev.privKeyB64 }, NET)
    ).rejects.toMatchObject({ kind: 'unreachable' })
  })
  it('maps a TLS failure code to unreachable', async () => {
    const dev = generateDevice()
    requestOnce.mockRejectedValueOnce(
      Object.assign(new Error('certificate has expired'), { code: 'CERT_HAS_EXPIRED' })
    )
    await expect(
      fetchConfig(TARGET, { deviceId: dev.deviceId, privKeyB64: dev.privKeyB64 }, NET)
    ).rejects.toMatchObject({ kind: 'unreachable' })
  })
  it('maps a guard refusal (CPX_GUARD_REFUSED) to blocked', async () => {
    const dev = generateDevice()
    requestOnce.mockRejectedValueOnce(
      Object.assign(new Error('Refusing to connect to non-public address: 10.0.0.1'), {
        code: 'CPX_GUARD_REFUSED',
        phase: 'pre-send'
      })
    )
    await expect(
      fetchConfig(TARGET, { deviceId: dev.deviceId, privKeyB64: dev.privKeyB64 }, NET)
    ).rejects.toMatchObject({ kind: 'blocked', phase: 'pre-send' })
  })
  it('maps CPX_TIMEOUT to transient without a status', async () => {
    const dev = generateDevice()
    requestOnce.mockRejectedValueOnce(
      Object.assign(new Error('Request timed out'), { code: 'CPX_TIMEOUT', phase: 'pre-send' })
    )
    const err = (await fetchConfig(
      TARGET,
      { deviceId: dev.deviceId, privKeyB64: dev.privKeyB64 },
      NET
    ).catch((e) => e)) as GatewayError
    expect(err.kind).toBe('transient')
    expect(err.status).toBeUndefined()
  })
  it('maps a timeout/generic error (no network code) to transient', async () => {
    const dev = generateDevice()
    requestOnce.mockRejectedValueOnce(new Error('Request timed out'))
    await expect(
      fetchConfig(TARGET, { deviceId: dev.deviceId, privKeyB64: dev.privKeyB64 }, NET)
    ).rejects.toMatchObject({ kind: 'transient' })
  })
})

describe('gateway.revoke', () => {
  it('signs op=revoke and posts; idempotent ok', async () => {
    const dev = generateDevice()
    const nonceBuf = Buffer.alloc(32, 3)
    jsonReply({ nonceId: 'N1', nonce: nonceBuf.toString('base64'), exp: 60 })
    jsonReply({ ok: true })
    await revoke(TARGET, { deviceId: dev.deviceId, privKeyB64: dev.privKeyB64 }, NET)
    const body = lastBody()
    const input = buildSignInput(OP_REVOKE, dev.deviceId, 'N1', nonceBuf, body.ts)
    expect(verifyRequest(dev.pubKeyB64, input, body.sig)).toBe(true)
  })
})

describe('gateway encoding/timestamp', () => {
  it('nonce is echoed back as the same base64 string; ts is integer ms', async () => {
    const dev = generateDevice()
    const nonceB64 = Buffer.alloc(32, 5).toString('base64')
    jsonReply({ nonceId: 'N1', nonce: nonceB64, exp: 60 })
    rawReply(CLASH)
    const before = Date.now()
    await fetchConfig(TARGET, { deviceId: dev.deviceId, privKeyB64: dev.privKeyB64 }, NET)
    const body = lastBody()
    expect(body.nonce).toBe(nonceB64)
    expect(Number.isInteger(body.ts)).toBe(true)
    expect(body.ts).toBeGreaterThanOrEqual(before)
  })
})

describe('gateway urlOf host-escape defense', () => {
  it('refuses an endpoint that escapes the gateway origin (backslash) before any request', async () => {
    const evil = {
      gateway: 'https://gw.front.com',
      endpoints: { enroll: '/e', challenge: '/\\evil.example/c', config: '/cfg', revoke: '/r' }
    }
    requestOnce.mockClear()
    await expect(challenge(evil, 'DID', NET)).rejects.toMatchObject({ kind: 'transient' })
    expect(requestOnce).not.toHaveBeenCalled()
  })
})

// §4 机场消息
describe('gateway provider message (§4.2)', () => {
  const dev = generateDevice()
  const cred = (): { deviceId: string; privKeyB64: string } => ({
    deviceId: dev.deviceId,
    privKeyB64: dev.privKeyB64
  })
  it('extracts message from a revoked response', async () => {
    jsonReply({ error: 'revoked', message: '订阅已于 2026-09-01 到期，续费后请重新登录。' }, 403)
    await expect(fetchConfig(TARGET, cred(), NET)).rejects.toMatchObject({
      kind: 'revoked',
      providerMessage: '订阅已于 2026-09-01 到期，续费后请重新登录。'
    })
  })
  it('keeps newlines but strips other control characters', async () => {
    jsonReply({ error: 'gateway_retired', message: 'a\u0001b\nc' }, 410)
    await expect(fetchConfig(TARGET, cred(), NET)).rejects.toMatchObject({
      kind: 'retired',
      providerMessage: 'ab\nc'
    })
  })
  it('truncates to 200 code points', async () => {
    jsonReply({ error: 'x', message: '字'.repeat(201) }, 503)
    const err = (await fetchConfig(TARGET, cred(), NET).catch((e) => e)) as GatewayError
    expect(err.kind).toBe('transient')
    expect(Array.from(err.providerMessage ?? '')).toHaveLength(200)
  })
  it('ignores a non-string or empty message', async () => {
    jsonReply({ error: 'revoked', message: { text: 'no' } }, 403)
    const a = (await fetchConfig(TARGET, cred(), NET).catch((e) => e)) as GatewayError
    expect(a.providerMessage).toBeUndefined()
    jsonReply({ error: 'revoked', message: '   ' }, 403)
    const b = (await fetchConfig(TARGET, cred(), NET).catch((e) => e)) as GatewayError
    expect(b.providerMessage).toBeUndefined()
  })
})

// §5 X-CPX-Discovery 头
describe('gateway fetchConfig discovery header (§5.2)', () => {
  const dev = generateDevice()
  const cred = (): { deviceId: string; privKeyB64: string } => ({
    deviceId: dev.deviceId,
    privKeyB64: dev.privKeyB64
  })
  it('returns a single string header as discovery', async () => {
    jsonReply({ nonceId: 'N1', nonce: Buffer.alloc(32, 1).toString('base64'), exp: 60 })
    requestOnce.mockResolvedValueOnce({
      status: 200,
      headers: { 'x-cpx-discovery': 'AAAA.BBBB' },
      body: CLASH
    })
    const r = await fetchConfig(TARGET, cred(), NET)
    expect(r).toEqual({ yaml: CLASH, discovery: 'AAAA.BBBB' })
  })
  it('ignores an array-valued header', async () => {
    jsonReply({ nonceId: 'N1', nonce: Buffer.alloc(32, 1).toString('base64'), exp: 60 })
    requestOnce.mockResolvedValueOnce({
      status: 200,
      headers: { 'x-cpx-discovery': ['a.b', 'c.d'] },
      body: CLASH
    })
    const r = await fetchConfig(TARGET, cred(), NET)
    expect(r.discovery).toBeUndefined()
    expect(r.yaml).toBe(CLASH)
  })
})

describe('R2-ISS-009: transport errors after the response headers', () => {
  it('maps a status-bearing transport error to transient(status); 410 to retired', async () => {
    requestOnce.mockRejectedValueOnce(
      Object.assign(new Error('aborted'), {
        code: 'ECONNRESET',
        phase: 'possibly-sent',
        status: 503
      })
    )
    await expect(challenge(TARGET, 'DID', NET)).rejects.toMatchObject({
      kind: 'transient',
      status: 503,
      phase: 'possibly-sent'
    })
    requestOnce.mockRejectedValueOnce(
      Object.assign(new Error('aborted'), {
        code: 'ECONNRESET',
        phase: 'possibly-sent',
        status: 410
      })
    )
    await expect(challenge(TARGET, 'DID', NET)).rejects.toMatchObject({
      kind: 'retired',
      status: 410
    })
  })
})

describe('R2-ISS-039/040: proxy tunnel failure mapping and config structure', () => {
  it('maps CPX_PROXY_CONNECT_FAILED to unreachable so gateway recovery treats it as a path failure', async () => {
    requestOnce.mockRejectedValueOnce(
      Object.assign(new Error('tunnel'), { code: 'CPX_PROXY_CONNECT_FAILED', phase: 'pre-send' })
    )
    await expect(challenge(TARGET, 'DID', NET)).rejects.toMatchObject({
      kind: 'unreachable',
      phase: 'pre-send'
    })
  })
  it('rejects a 200 body whose proxies / proxy-providers have the wrong shape', async () => {
    const dev = generateDevice()
    for (const body of [
      'proxies: definitely-not-a-list\n',
      'proxy-providers: true\n',
      'proxies:\n  a: 1\n',
      // R2-ISS-040b: a valid field must not mask a present-but-wrong-typed one
      'proxies: definitely-not-a-list\nproxy-providers: {}\n',
      'proxies: []\nproxy-providers: true\n',
      // R2-ISS-046: structurally unloadable elements are rejected
      'proxies:\n  - null\n',
      'proxies:\n  - just-a-string\n',
      'proxy-providers:\n  p: true\n'
    ]) {
      jsonReply({ nonceId: 'N1', nonce: Buffer.alloc(32, 1).toString('base64'), exp: 60 })
      rawReply(body)
      await expect(
        fetchConfig(TARGET, { deviceId: dev.deviceId, privKeyB64: dev.privKeyB64 }, NET)
      ).rejects.toMatchObject({ kind: 'transient' })
    }
    jsonReply({ nonceId: 'N1', nonce: Buffer.alloc(32, 1).toString('base64'), exp: 60 })
    rawReply('proxy-providers:\n  p:\n    type: http\n    url: https://x.example/sub\n')
    await expect(
      fetchConfig(TARGET, { deviceId: dev.deviceId, privKeyB64: dev.privKeyB64 }, NET)
    ).resolves.toMatchObject({ yaml: expect.stringContaining('proxy-providers') })
  })
})
