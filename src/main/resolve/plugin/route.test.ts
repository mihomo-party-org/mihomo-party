import { describe, it, expect, vi } from 'vitest'
import {
  CPX_GUARD_REFUSED,
  CPX_REDIRECT_REFUSED,
  CPX_RESPONSE_TOO_LARGE,
  CPX_TIMEOUT,
  codedError
} from './errors'
import {
  autoRouteProvider,
  baseRouteOf,
  createRouteProvider,
  effectiveRouteMode,
  isFailoverError,
  preflightGuard,
  resolveLocalProxy,
  singleRouteProvider
} from './route'

const controledConfig: { 'mixed-port': number; authentication?: string[] } = { 'mixed-port': 7890 }
vi.mock('../../config/controledMihomo', () => ({
  getControledMihomoConfig: async () => controledConfig
}))

const ITEM: IPluginItem = {
  id: 'p1',
  name: 'XX',
  loginUrl: 'https://panel.xx.com/oauth/authorize',
  spec: 'cpx-plugin/2',
  status: 'active',
  created: 0,
  updated: 0
}
const PROXY = async (): Promise<{ host: string; port: number }> => ({
  host: '127.0.0.1',
  port: 7890
})

describe('effectiveRouteMode (§1.5 five-row migration table)', () => {
  it.each([
    ['proxy', true, false, 'proxy'],
    ['auto', undefined, true, 'auto'],
    ['direct', true, true, 'direct'],
    [undefined, true, undefined, 'proxy'],
    [undefined, false, true, 'auto'],
    [undefined, undefined, true, 'proxy'],
    [undefined, undefined, false, 'auto'],
    [undefined, undefined, undefined, 'auto']
  ] as const)(
    'routeMode=%s useProxy=%s global=%s → %s',
    (routeMode, useProxy, pluginUseProxy, expected) => {
      expect(effectiveRouteMode({ ...ITEM, routeMode, useProxy }, { pluginUseProxy })).toBe(
        expected
      )
    }
  )
})

describe('createRouteProvider', () => {
  it('auto without lastGoodRoute → [direct, proxy], guarded', async () => {
    const p = createRouteProvider({ ...ITEM, routeMode: 'auto' }, {}, undefined, PROXY)
    expect(await p.candidates()).toEqual(['direct', 'proxy'])
    expect(p.guardNonDirect).toBe(true)
  })
  it('auto with lastGoodRoute=proxy → [proxy, direct]', async () => {
    const p = createRouteProvider(
      { ...ITEM, routeMode: 'auto', lastGoodRoute: 'proxy' },
      {},
      undefined,
      PROXY
    )
    expect(await p.candidates()).toEqual(['proxy', 'direct'])
  })
  it('initialRoute overrides lastGoodRoute', async () => {
    const p = createRouteProvider(
      { ...ITEM, routeMode: 'auto', lastGoodRoute: 'direct' },
      {},
      'proxy',
      PROXY
    )
    expect(await p.candidates()).toEqual(['proxy', 'direct'])
  })
  it('ignores an invalid persisted lastGoodRoute', async () => {
    const p = createRouteProvider(
      { ...ITEM, routeMode: 'auto', lastGoodRoute: 'bootstrap:0' as never },
      {},
      undefined,
      PROXY
    )
    expect(await p.candidates()).toEqual(['direct', 'proxy'])
  })
  it('explicit proxy → single unguarded route; explicit direct → single route', async () => {
    const proxy = createRouteProvider({ ...ITEM, routeMode: 'proxy' }, {}, undefined, PROXY)
    expect(await proxy.candidates()).toEqual(['proxy'])
    expect(proxy.guardNonDirect).toBe(false)
    const direct = createRouteProvider({ ...ITEM, routeMode: 'direct' }, {}, undefined, PROXY)
    expect(await direct.candidates()).toEqual(['direct'])
  })
})

describe('singleRouteProvider / autoRouteProvider', () => {
  it('resolves the proxy lazily, once, and only for the proxy key', async () => {
    const resolve = vi.fn(async () => ({ host: '127.0.0.1', port: 7890 }))
    const p = autoRouteProvider('direct', resolve)
    expect(resolve).not.toHaveBeenCalled()
    expect(await p.proxyFor('direct')).toBeUndefined()
    expect(await p.proxyFor('proxy')).toEqual({ host: '127.0.0.1', port: 7890 })
    expect(await p.proxyFor('proxy')).toEqual({ host: '127.0.0.1', port: 7890 })
    expect(resolve).toHaveBeenCalledTimes(1)
  })
  it('dispose is a no-op', async () => {
    await expect(singleRouteProvider('direct').dispose(true)).resolves.toBeUndefined()
  })
  it('baseRouteOf maps bootstrap keys to undefined (never persisted as lastGoodRoute)', () => {
    expect(baseRouteOf('direct')).toBe('direct')
    expect(baseRouteOf('proxy')).toBe('proxy')
    expect(baseRouteOf('bootstrap:0')).toBeUndefined()
  })
})

describe('isFailoverError (§1.3)', () => {
  const e = (code: string, phase?: 'pre-send' | 'possibly-sent'): Error =>
    codedError('x', code, phase)
  it('safe: network errno and CPX_TIMEOUT fail over; responses/guard/size/redirect do not', () => {
    expect(isFailoverError(e(CPX_TIMEOUT, 'pre-send'), 'safe')).toBe(true)
    expect(isFailoverError(e('ENOTFOUND', 'pre-send'), 'safe')).toBe(true)
    expect(isFailoverError(e('ECONNRESET', 'possibly-sent'), 'safe')).toBe(true)
    expect(isFailoverError(e('CERT_HAS_EXPIRED', 'pre-send'), 'safe')).toBe(true)
    expect(isFailoverError(e(CPX_REDIRECT_REFUSED, 'possibly-sent'), 'safe')).toBe(false)
    expect(isFailoverError(e(CPX_RESPONSE_TOO_LARGE, 'possibly-sent'), 'safe')).toBe(false)
    expect(isFailoverError(e(CPX_GUARD_REFUSED, 'pre-send'), 'safe')).toBe(false)
    expect(isFailoverError(new Error('plain'), 'safe')).toBe(false)
  })
  it('pre-send-only: only pre-send network errno; never timeouts or possibly-sent errors', () => {
    expect(isFailoverError(e(CPX_TIMEOUT, 'pre-send'), 'pre-send-only')).toBe(false)
    expect(isFailoverError(e('ECONNRESET', 'possibly-sent'), 'pre-send-only')).toBe(false)
    expect(isFailoverError(e('ECONNREFUSED', 'possibly-sent'), 'pre-send-only')).toBe(false)
    expect(isFailoverError(e('ECONNREFUSED', 'pre-send'), 'pre-send-only')).toBe(true)
    expect(isFailoverError(e('ENOTFOUND', 'pre-send'), 'pre-send-only')).toBe(true)
    expect(isFailoverError(e('ECONNREFUSED'), 'pre-send-only')).toBe(false)
  })
})

describe('R2-ISS-039: proxy tunnel failure', () => {
  it('is failover-class under both policies (pre-send connection failure)', () => {
    const e = codedError('tunnel', 'CPX_PROXY_CONNECT_FAILED', 'pre-send')
    expect(isFailoverError(e, 'safe')).toBe(true)
    expect(isFailoverError(e, 'pre-send-only')).toBe(true)
  })
})

describe('R2-ISS-009: errors that carry an HTTP status', () => {
  const e = (code: string, phase?: 'pre-send' | 'possibly-sent'): unknown =>
    codedError('x', code, phase)
  it('never fail over, under either policy', () => {
    expect(
      isFailoverError(Object.assign(e('ECONNRESET', 'possibly-sent'), { status: 503 }), 'safe')
    ).toBe(false)
    expect(
      isFailoverError(Object.assign(e(CPX_TIMEOUT, 'possibly-sent'), { status: 200 }), 'safe')
    ).toBe(false)
    expect(
      isFailoverError(
        Object.assign(e('ECONNREFUSED', 'pre-send'), { status: 500 }),
        'pre-send-only'
      )
    ).toBe(false)
  })
})

describe('preflightGuard (§1.4)', () => {
  it('rejects when any resolved address is private', async () => {
    const resolveAll = async (): Promise<{ address: string; family: number }[]> => [
      { address: '1.1.1.1', family: 4 },
      { address: '10.0.0.1', family: 4 }
    ]
    await expect(preflightGuard('gw.front.com', resolveAll)).rejects.toMatchObject({
      code: CPX_GUARD_REFUSED
    })
  })
  it('allows a target that fails to resolve (proxy side resolves it)', async () => {
    const resolveAll = async (): Promise<never> => {
      throw Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' })
    }
    await expect(preflightGuard('gw.front.com', resolveAll)).resolves.toBeUndefined()
  })
  it('ISS-003: rejects with CPX_TIMEOUT when the signal aborts while resolving', async () => {
    const ac = new AbortController()
    const pending = preflightGuard('gw.front.com', () => new Promise(() => {}), ac.signal)
    ac.abort(new Error('budget exhausted'))
    await expect(pending).rejects.toMatchObject({ code: CPX_TIMEOUT, phase: 'pre-send' })
    ac.abort()
    await expect(
      preflightGuard('gw.front.com', async () => [{ address: '1.1.1.1', family: 4 }], ac.signal)
    ).rejects.toMatchObject({ code: CPX_TIMEOUT })
  })
  it('allows all-public targets and strips IPv6 brackets before resolving', async () => {
    const seen: string[] = []
    const resolveAll = async (h: string): Promise<{ address: string; family: number }[]> => {
      seen.push(h)
      return [{ address: '2606:4700::1', family: 6 }]
    }
    await expect(preflightGuard('[2606:4700::1]', resolveAll)).resolves.toBeUndefined()
    expect(seen).toEqual(['2606:4700::1'])
  })
})

describe('resolveLocalProxy (R2-ISS-047)', () => {
  it('has no auth when the core has no inbound authentication', async () => {
    controledConfig.authentication = []
    expect(await resolveLocalProxy()).toEqual({ host: '127.0.0.1', port: 7890 })
  })
  it('R2-ISS-054: a disabled mixed-port (0) makes the proxy unavailable instead of falling back to port 80', async () => {
    const saved = controledConfig['mixed-port']
    controledConfig.authentication = ['user:pass']
    try {
      for (const bad of [0, -1, 70000, 1.5]) {
        controledConfig['mixed-port'] = bad
        await expect(resolveLocalProxy()).rejects.toMatchObject({
          code: 'CPX_PROXY_CONNECT_FAILED',
          phase: 'pre-send'
        })
      }
    } finally {
      controledConfig['mixed-port'] = saved
      controledConfig.authentication = []
    }
  })

  it('carries the first user:pass credential, split on the first colon', async () => {
    controledConfig.authentication = ['user:p:a:ss']
    expect(await resolveLocalProxy()).toEqual({
      host: '127.0.0.1',
      port: 7890,
      auth: { user: 'user', pass: 'p:a:ss' }
    })
  })
})
