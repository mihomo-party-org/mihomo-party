import { describe, it, expect, vi, beforeEach } from 'vitest'

const requestOnce = vi.fn()
vi.mock('./http-client', () => ({ requestOnce: (...a: unknown[]) => requestOnce(...a) }))
vi.mock('../../config/plugin', () => ({ getPluginItem: vi.fn() }))
vi.mock('./vault', () => ({ readVault: vi.fn() }))

import { readFileSync } from 'fs'
import { join } from 'path'
import { createPrivateKey, sign } from 'crypto'
import { discoverGateway } from './discovery'
import { buildDiscoverySignInput } from './discovery-sig'
import { CPX_GUARD_REFUSED, CPX_TIMEOUT, codedError } from './errors'
import { runOperation, type OperationContext } from './operation'
import { autoRouteProvider } from './route'

const OK = {
  spec: 'cpx-plugin/2',
  gateway: 'https://gw.front.com',
  endpoints: { enroll: '/enroll', challenge: '/challenge', config: '/config', revoke: '/revoke' }
}
function reply(body: unknown, status = 200): void {
  requestOnce.mockResolvedValueOnce({ status, headers: {}, body: JSON.stringify(body) })
}
// RoutedRequester 适配：把 op 层的路由执行器直接接到被 mock 的 requestOnce 上
const NET = { request: (url: string, opts: unknown) => requestOnce(url, opts) }
const CTX = { requester: NET } as unknown as OperationContext
const SRC = ['https://panel.xx.com']
const disc = (sources: string[] = SRC): Promise<IDiscoveryCandidate> =>
  discoverGateway({ sources }, CTX)

beforeEach(() => requestOnce.mockReset())

describe('discoverGateway', () => {
  it('fetches the well-known document from the source origin and returns parsed gateways', async () => {
    reply(OK)
    const wk = await disc()
    expect(requestOnce).toHaveBeenCalledWith(
      'https://panel.xx.com/.well-known/cpx-gateway',
      expect.objectContaining({ method: 'GET' })
    )
    expect(wk.gateways).toEqual(['https://gw.front.com'])
    expect(wk.endpoints.config).toBe('/config')
  })
  it('rejects non-https gateway', async () => {
    reply({ ...OK, gateway: 'http://gw.front.com' })
    await expect(disc()).rejects.toThrow()
  })
  it('rejects gateway with a path', async () => {
    reply({ ...OK, gateway: 'https://gw.front.com/base' })
    await expect(disc()).rejects.toThrow()
  })
  it('rejects gateway with query/fragment', async () => {
    reply({ ...OK, gateway: 'https://gw.front.com/?x=1' })
    await expect(disc()).rejects.toThrow()
  })
  it('rejects a private-IP gateway literal', async () => {
    reply({ ...OK, gateway: 'https://127.0.0.1' })
    await expect(disc()).rejects.toThrow()
  })
  it('rejects a localhost gateway', async () => {
    reply({ ...OK, gateway: 'https://localhost' })
    await expect(disc()).rejects.toThrow()
  })
  it('rejects a *.localhost gateway', async () => {
    reply({ ...OK, gateway: 'https://gw.localhost' })
    await expect(disc()).rejects.toThrow()
  })
  it('rejects a gateway with userinfo', async () => {
    reply({ ...OK, gateway: 'https://u:p@gw.front.com' })
    await expect(disc()).rejects.toThrow()
  })
  it('rejects an absolute endpoint url', async () => {
    reply({ ...OK, endpoints: { ...OK.endpoints, config: 'https://evil.com/c' } })
    await expect(disc()).rejects.toThrow()
  })
  it('rejects an endpoint not starting with /', async () => {
    reply({ ...OK, endpoints: { ...OK.endpoints, config: 'config' } })
    await expect(disc()).rejects.toThrow()
  })
  it('rejects wrong spec', async () => {
    reply({ ...OK, spec: 'cpx-plugin/1' })
    await expect(disc()).rejects.toThrow()
  })
  it('rejects malformed JSON body', async () => {
    requestOnce.mockResolvedValueOnce({ status: 200, headers: {}, body: 'nope' })
    await expect(disc()).rejects.toThrow()
  })
  it('rejects non-2xx status', async () => {
    requestOnce.mockResolvedValueOnce({ status: 404, headers: {}, body: '{}' })
    await expect(disc()).rejects.toThrow()
  })

  // §2.2 多网关
  it('gateways missing → [gateway]', async () => {
    reply(OK)
    expect((await disc()).gateways).toEqual(['https://gw.front.com'])
  })
  it('accepts up to 3 gateways, deduplicated, with gateway === gateways[0]', async () => {
    reply({
      ...OK,
      gateways: ['https://gw.front.com', 'https://gw2.front.com/', 'https://gw2.front.com']
    })
    expect((await disc()).gateways).toEqual(['https://gw.front.com', 'https://gw2.front.com'])
  })
  it('rejects 4 gateways', async () => {
    reply({ ...OK, gateways: ['https://gw.front.com', 'https://b', 'https://c', 'https://d'] })
    await expect(disc()).rejects.toThrow(/gateways/)
  })
  it('rejects an empty gateways list', async () => {
    reply({ ...OK, gateways: [] })
    await expect(disc()).rejects.toThrow(/gateways/)
  })
  it('rejects the whole document when any gateway is private', async () => {
    reply({ ...OK, gateways: ['https://gw.front.com', 'https://10.0.0.1'] })
    await expect(disc()).rejects.toThrow(/gateways/)
  })
  it('rejects when gateway !== gateways[0]', async () => {
    reply({ ...OK, gateways: ['https://gw2.front.com', 'https://gw.front.com'] })
    await expect(disc()).rejects.toThrow(/gateways\[0\]/)
  })
})

// §3 多发现源
describe('discoverGateway with multiple sources', () => {
  const TWO = ['https://panel.xx.com', 'https://cdn.xx.com']

  it('source 1 returns 404, source 2 is valid → success from source 2', async () => {
    requestOnce.mockResolvedValueOnce({ status: 404, headers: {}, body: 'not here' })
    reply(OK)
    const wk = await disc(TWO)
    expect(wk.gateways).toEqual(['https://gw.front.com'])
    expect(requestOnce.mock.calls.map((c) => c[0])).toEqual([
      'https://panel.xx.com/.well-known/cpx-gateway',
      'https://cdn.xx.com/.well-known/cpx-gateway'
    ])
  })
  it('source 1 refused by the guard → skipped, source 2 continues', async () => {
    requestOnce.mockRejectedValueOnce(codedError('refused', CPX_GUARD_REFUSED, 'pre-send'))
    reply(OK)
    await expect(disc(TWO)).resolves.toMatchObject({ gateways: ['https://gw.front.com'] })
  })
  it('source 1 invalid document → next source', async () => {
    reply({ ...OK, spec: 'cpx-plugin/1' })
    reply(OK)
    await expect(disc(TWO)).resolves.toMatchObject({ gateways: ['https://gw.front.com'] })
  })
  it('R2-ISS-004: endpoint paths in the candidate are normalized', async () => {
    reply({ ...OK, endpoints: { ...OK.endpoints, config: '/v1/../config' } })
    expect((await disc()).endpoints.config).toBe('/config')
  })
  it('all sources fail → throws the last error', async () => {
    requestOnce.mockResolvedValueOnce({ status: 404, headers: {}, body: '' })
    requestOnce.mockResolvedValueOnce({ status: 500, headers: {}, body: '' })
    await expect(disc(TWO)).rejects.toMatchObject({ status: 500 })
  })
  it('route stickiness is per source: source 1 direct 404, source 2 direct timeout → source 2 via proxy', async () => {
    requestOnce.mockResolvedValueOnce({ status: 404, headers: {}, body: '' })
    requestOnce.mockRejectedValueOnce(codedError('timeout', CPX_TIMEOUT, 'pre-send'))
    reply(OK)
    const item = {
      id: 'p',
      name: 'X',
      loginUrl: 'https://panel.xx.com/oauth/authorize',
      spec: 'cpx-plugin/2',
      status: 'needs-login',
      routeMode: 'auto',
      created: 0,
      updated: 0
    } as IPluginItem
    const r = await runOperation(
      {
        item,
        app: { subscriptionTimeout: 5000 },
        retryPolicy: 'safe',
        routeProvider: autoRouteProvider('direct', async () => ({ host: '127.0.0.1', port: 7890 })),
        resolveAll: async () => [{ address: '1.1.1.1', family: 4 }]
      },
      (ctx) => discoverGateway({ sources: TWO }, ctx)
    )
    expect(r.ok).toBe(true)
    const calls = requestOnce.mock.calls.map((c) => [c[0], (c[1] as { proxy?: unknown }).proxy])
    expect(calls).toEqual([
      ['https://panel.xx.com/.well-known/cpx-gateway', undefined],
      ['https://cdn.xx.com/.well-known/cpx-gateway', undefined],
      ['https://cdn.xx.com/.well-known/cpx-gateway', { host: '127.0.0.1', port: 7890 }]
    ])
  })
})

// §5a 签名发现文档
describe('discoverGateway with a signer (§5.3)', () => {
  interface Vector {
    seedB64: string
    pubKeyB64: string
    payloadJson: string
    signed: string
    digestHex: string
  }
  const vectors: Vector[] = JSON.parse(
    readFileSync(join(__dirname, '__fixtures__', 'discovery-vectors.json'), 'utf-8')
  )
  const V = vectors[0]
  const PAYLOAD = JSON.parse(V.payloadJson) as {
    seq: number
    gateways: string[]
    endpoints: IGatewayEndpoints
    loginUrl: string
    discoveryUrls: string[]
  }
  const PKCS8 = Buffer.from('302e020100300506032b657004220420', 'hex')
  function envelope(payload: Record<string, unknown>): string {
    const bytes = Buffer.from(JSON.stringify(payload), 'utf-8')
    const key = createPrivateKey({
      key: Buffer.concat([PKCS8, Buffer.from(V.seedB64, 'base64')]),
      format: 'der',
      type: 'pkcs8'
    })
    return `${bytes.toString('base64')}.${sign(null, buildDiscoverySignInput(bytes), key).toString('base64')}`
  }
  // 顶层字段从同一 payload 生成，天然一致
  function doc(
    payload = PAYLOAD as unknown as Record<string, unknown>,
    signed = envelope(payload)
  ): unknown {
    return {
      spec: 'cpx-plugin/2',
      gateway: (payload.gateways as string[])[0],
      gateways: payload.gateways,
      endpoints: payload.endpoints,
      signed
    }
  }
  const signer = (minSeq?: number, currentDigest?: string): DiscoverySigner => ({
    pubKeyB64: V.pubKeyB64,
    minSeq,
    currentDigest
  })
  const TWO = ['https://panel.xx.com', 'https://cdn.xx.com']
  const discS = (s: DiscoverySigner | undefined, sources = SRC): Promise<IDiscoveryCandidate> =>
    discoverGateway({ sources, signer: s }, CTX)

  it('keyed plugin, no signed field → that source fails (downgrade protection), next source is tried', async () => {
    reply(OK)
    reply(doc())
    const c = await discS(signer(), TWO)
    expect(c.seq).toBe(PAYLOAD.seq)
    expect(requestOnce).toHaveBeenCalledTimes(2)
  })
  it('keyed plugin, valid signed and consistent top level → candidate comes from the payload', async () => {
    reply(doc())
    const c = await discS(signer())
    expect(c).toEqual({
      gateways: PAYLOAD.gateways,
      endpoints: PAYLOAD.endpoints,
      seq: PAYLOAD.seq,
      digest: V.digestHex,
      loginUrl: PAYLOAD.loginUrl,
      discoveryUrls: PAYLOAD.discoveryUrls
    })
  })
  it('top-level gateway disagrees with the payload → source invalid, next source used', async () => {
    const d = doc() as Record<string, unknown>
    reply({ ...d, gateway: 'https://other.example', gateways: ['https://other.example'] })
    reply(doc())
    const c = await discS(signer(), TWO)
    expect(c.gateways).toEqual(PAYLOAD.gateways)
    expect(requestOnce).toHaveBeenCalledTimes(2)
  })
  it('R2-ISS-004: equivalent endpoint spellings agree after normalization', async () => {
    const p = {
      ...PAYLOAD,
      endpoints: { ...PAYLOAD.endpoints, config: '/v1/../config' }
    } as unknown as Record<string, unknown>
    const d = doc(p) as Record<string, unknown>
    // top-level spells it "/config", the signed payload "/v1/../config": same request path
    reply({ ...d, endpoints: { ...PAYLOAD.endpoints, config: '/config' } })
    const c = await discS(signer())
    expect(c.endpoints.config).toBe('/config')
    expect(c.seq).toBe(PAYLOAD.seq)
  })
  it('unkeyed plugin ignores signed entirely', async () => {
    reply(doc({ ...PAYLOAD, seq: 99 } as unknown as Record<string, unknown>, 'garbage.garbage'))
    const c = await discS(undefined)
    expect(c.seq).toBeUndefined()
    expect(c.gateways).toEqual(PAYLOAD.gateways)
  })
  it('source 1 rolls seq back, source 2 is current → source 2 wins', async () => {
    // stored seq 11 with a different digest: source 1 (seq 11) is an equivocation, source 2 (seq 12) is newer
    reply(doc({ ...PAYLOAD, seq: 11 } as unknown as Record<string, unknown>))
    reply(doc())
    const c = await discS(signer(11, 'other-digest'), TWO)
    expect(c.seq).toBe(12)
    expect(requestOnce).toHaveBeenCalledTimes(2)
  })
  it('same seq with a different digest is rejected (equivocation), same digest aligns', async () => {
    reply(doc())
    await expect(discS(signer(12, 'not-the-digest'))).rejects.toThrow(/equivocation/)
    reply(doc())
    await expect(discS(signer(12, V.digestHex))).resolves.toMatchObject({ seq: 12 })
  })
  it('discoveryUrls missing → undefined (unchanged); [] → cleared', async () => {
    const { discoveryUrls: _d, ...noUrls } = PAYLOAD as unknown as Record<string, unknown>
    reply(doc(noUrls))
    expect((await discS(signer())).discoveryUrls).toBeUndefined()
    reply(doc({ ...PAYLOAD, discoveryUrls: [] } as unknown as Record<string, unknown>))
    expect((await discS(signer())).discoveryUrls).toEqual([])
  })
  it('a bad signature makes the source invalid', async () => {
    const d = doc() as { signed: string }
    const [p, sig] = d.signed.split('.')
    const bad = Buffer.from(sig, 'base64')
    bad[0] ^= 1
    reply({ ...d, signed: `${p}.${bad.toString('base64')}` })
    await expect(discS(signer())).rejects.toThrow(/signature/)
  })
})
