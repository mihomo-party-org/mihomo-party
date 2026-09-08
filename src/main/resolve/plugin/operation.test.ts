import { describe, it, expect, vi, beforeEach } from 'vitest'

const requestOnce = vi.fn()
vi.mock('./http-client', () => ({ requestOnce: (...a: unknown[]) => requestOnce(...a) }))

const items: Record<string, IPluginItem> = {}
const vaults: Record<string, IPluginVault> = {}
vi.mock('../../config/plugin', () => ({
  getPluginItem: vi.fn(async (id: string) => items[id])
}))
vi.mock('./vault', () => ({
  readVault: vi.fn(async (id: string) =>
    vaults[id] ? { kind: 'ok' as const, vault: vaults[id] } : { kind: 'missing' as const }
  )
}))

import { CPX_GUARD_REFUSED, CPX_REDIRECT_REFUSED, CPX_TIMEOUT, codedError } from './errors'
import {
  createBudget,
  runOperation,
  runPluginOperation,
  withPluginLock,
  markPluginRemoved,
  PluginNotFoundError,
  type OperationContext
} from './operation'
import { abortable, autoRouteProvider, singleRouteProvider, type RouteProvider } from './route'
import { KeyedWriteQueue } from '../../utils/safeFile'

const ITEM: IPluginItem = {
  id: 'p1',
  name: 'XX',
  loginUrl: 'https://panel.xx.com/oauth/authorize',
  spec: 'cpx-plugin/2',
  status: 'active',
  created: 0,
  updated: 0
}
const APP: IAppConfig = { subscriptionTimeout: 5000 }
const PROXY = { host: '127.0.0.1', port: 7890 }
const GW = {
  gateway: 'https://gw.front.com',
  endpoints: { enroll: '/enroll', challenge: '/challenge', config: '/config', revoke: '/revoke' }
}

function reply(body = '{}', status = 200): void {
  requestOnce.mockResolvedValueOnce({ status, headers: {}, body })
}
function lastOpts(): Record<string, unknown> {
  const call = requestOnce.mock.calls[requestOnce.mock.calls.length - 1]
  return call[1] as Record<string, unknown>
}
function spyProvider(
  route: 'direct' | 'proxy',
  resolveProxy = async () => PROXY
): RouteProvider & {
  dispose: ReturnType<typeof vi.fn>
} {
  const inner = singleRouteProvider(route, resolveProxy)
  return { ...inner, dispose: vi.fn(async () => {}) }
}

beforeEach(() => {
  requestOnce.mockReset()
  for (const k of Object.keys(items)) delete items[k]
  for (const k of Object.keys(vaults)) delete vaults[k]
})

describe('runOperation', () => {
  it('sends through the single direct route with a guarded lookup and no proxy', async () => {
    reply()
    const r = await runOperation(
      { item: ITEM, app: APP, retryPolicy: 'safe', routeProvider: spyProvider('direct') },
      (ctx) => ctx.requester.request('https://gw.front.com/x', { method: 'GET', maxBytes: 10 })
    )
    expect(r.ok).toBe(true)
    const opts = lastOpts()
    expect(opts.proxy).toBeUndefined()
    expect(typeof opts.lookup).toBe('function')
    expect(opts.signal).toBeInstanceOf(AbortSignal)
    expect(opts.timeout).toBeLessThanOrEqual(5000)
    expect(r.selectedRoute).toBe('direct')
  })

  it('sends through the proxy route with the lazily resolved local proxy and no lookup', async () => {
    reply()
    reply()
    const resolveProxy = vi.fn(async () => PROXY)
    const r = await runOperation(
      {
        item: ITEM,
        app: APP,
        retryPolicy: 'safe',
        routeProvider: spyProvider('proxy', resolveProxy)
      },
      async (ctx) => {
        await ctx.requester.request('https://gw.front.com/a', { method: 'GET', maxBytes: 10 })
        await ctx.requester.request('https://gw.front.com/b', { method: 'GET', maxBytes: 10 })
      }
    )
    expect(r.ok).toBe(true)
    expect(lastOpts().proxy).toEqual(PROXY)
    expect(lastOpts().lookup).toBeUndefined()
    expect(resolveProxy).toHaveBeenCalledTimes(1)
    expect(r.selectedRoute).toBe('proxy')
  })

  it('derives the single route from item.useProxy over the global default (no provider injected)', async () => {
    reply()
    const r = await runOperation(
      { item: { ...ITEM, useProxy: false }, app: { pluginUseProxy: true }, retryPolicy: 'safe' },
      (ctx) => ctx.requester.request('https://gw.front.com/x', { method: 'GET', maxBytes: 10 })
    )
    expect(r.ok).toBe(true)
    expect(lastOpts().proxy).toBeUndefined()
    expect(r.selectedRoute).toBe('direct')
  })

  it('snapshots staged metadata on success', async () => {
    const r = await runOperation(
      { item: ITEM, app: APP, retryPolicy: 'safe', routeProvider: spyProvider('direct') },
      async (ctx) => {
        ctx.stage({ gatewayState: GW, itemPatch: { name: 'a' } })
        ctx.stage({ itemPatch: { site: 'https://s' } })
        return 1
      }
    )
    expect(r.ok).toBe(true)
    expect(r.gatewayState).toEqual(GW)
    expect(r.itemPatch).toEqual({ name: 'a', site: 'https://s' })
  })

  it('keeps staged metadata when fn throws (ok:false still carries gatewayState)', async () => {
    const r = await runOperation(
      { item: ITEM, app: APP, retryPolicy: 'safe', routeProvider: spyProvider('direct') },
      async (ctx) => {
        ctx.stage({ gatewayState: GW })
        throw new Error('boom')
      }
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect((r.error as Error).message).toBe('boom')
    expect(r.gatewayState).toEqual(GW)
    expect(r.selectedRoute).toBeUndefined()
  })

  it('calls dispose(false) after a normal finish, even when fn throws', async () => {
    const provider = spyProvider('direct')
    await runOperation(
      { item: ITEM, app: APP, retryPolicy: 'safe', routeProvider: provider },
      async () => {
        throw new Error('x')
      }
    )
    expect(provider.dispose).toHaveBeenCalledWith(false)
  })

  it('calls dispose(true) and maps the aborted request when the budget runs out', async () => {
    const provider = spyProvider('direct')
    requestOnce.mockImplementationOnce(
      (_url: string, opts: { signal: AbortSignal }) =>
        new Promise((_, reject) =>
          opts.signal.addEventListener('abort', () =>
            reject(codedError('Request timed out', CPX_TIMEOUT))
          )
        )
    )
    const r = await runOperation(
      { item: ITEM, app: APP, retryPolicy: 'safe', routeProvider: provider, budgetMs: 1500 },
      (ctx) => ctx.requester.request('https://gw.front.com/x', { method: 'GET', maxBytes: 10 })
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect((r.error as { code?: string }).code).toBe(CPX_TIMEOUT)
    expect(provider.dispose).toHaveBeenCalledWith(true)
  })

  it('refuses to send when less than 1s of budget remains', async () => {
    const r = await runOperation(
      {
        item: ITEM,
        app: APP,
        retryPolicy: 'safe',
        routeProvider: spyProvider('direct'),
        budgetMs: 500
      },
      (ctx) => ctx.requester.request('https://gw.front.com/x', { method: 'GET', maxBytes: 10 })
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatchObject({ kind: 'transient', message: 'budget exhausted' })
    expect(requestOnce).not.toHaveBeenCalled()
  })

  it('caps each request timeout at the remaining budget', async () => {
    reply()
    await runOperation(
      {
        item: ITEM,
        app: { subscriptionTimeout: 30000 },
        retryPolicy: 'safe',
        routeProvider: spyProvider('direct'),
        budgetMs: 3000
      },
      (ctx) => ctx.requester.request('https://gw.front.com/x', { method: 'GET', maxBytes: 10 })
    )
    expect(lastOpts().timeout).toBeLessThanOrEqual(3000)
  })
})

describe('R2 lifecycle fixes (transport / budget)', () => {
  it('R2-ISS-009: an error carrying an HTTP status fixes the route and never falls back', async () => {
    const provider = {
      ...autoRouteProvider('direct', async () => PROXY),
      dispose: vi.fn(async () => {})
    }
    const reset = Object.assign(codedError('socket hang up', 'ECONNRESET', 'possibly-sent'), {
      status: 503
    })
    requestOnce.mockRejectedValueOnce(reset)
    reply()
    const r = await runOperation(
      { item: ITEM, app: APP, retryPolicy: 'safe', routeProvider: provider },
      async (ctx) => {
        await expect(
          ctx.requester.request('https://gw.front.com/a', { method: 'GET', maxBytes: 10 })
        ).rejects.toMatchObject({ status: 503 })
        // the origin is now fixed to direct: no proxy probe for the second request
        await ctx.requester.request('https://gw.front.com/b', { method: 'GET', maxBytes: 10 })
        return 'ok'
      }
    )
    expect(r.ok).toBe(true)
    expect(r.selectedRoute).toBe('direct')
    expect(requestOnce).toHaveBeenCalledTimes(2)
    expect(lastOpts().proxy).toBeUndefined()
  })

  it('R2-ISS-039: a failed proxy tunnel falls back to direct instead of fixing the proxy route', async () => {
    const provider = {
      ...autoRouteProvider('proxy', async () => PROXY),
      dispose: vi.fn(async () => {})
    }
    requestOnce.mockRejectedValueOnce(codedError('tunnel', 'CPX_PROXY_CONNECT_FAILED', 'pre-send'))
    reply()
    const r = await runOperation(
      {
        item: ITEM,
        app: APP,
        retryPolicy: 'pre-send-only',
        routeProvider: provider,
        resolveAll: async () => [{ address: '1.1.1.1', family: 4 }]
      },
      (ctx) => ctx.requester.request('https://gw.front.com/x', { method: 'GET', maxBytes: 10 })
    )
    expect(r.ok).toBe(true)
    expect(r.selectedRoute).toBe('direct')
    expect(requestOnce).toHaveBeenCalledTimes(2)
    expect(lastOpts().proxy).toBeUndefined()
  })

  it('R2-ISS-010: a proxy resolver that never resolves is cut off by the budget', async () => {
    const provider = spyProvider('proxy', () => new Promise(() => {}))
    const r = await runOperation(
      { item: ITEM, app: APP, retryPolicy: 'safe', routeProvider: provider, budgetMs: 1200 },
      (ctx) => ctx.requester.request('https://gw.front.com/x', { method: 'GET', maxBytes: 10 })
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect((r.error as { code?: string }).code).toBe(CPX_TIMEOUT)
    expect(requestOnce).not.toHaveBeenCalled()
  })

  it('R2-ISS-002/032: the network phase ends at budget − reserve and the commit still runs on the (single) live signal', async () => {
    items.p1 = ITEM
    const commit = vi.fn(async (_r: unknown, _i: unknown, signal: AbortSignal) => {
      expect(signal.aborted).toBe(false)
      // a lock wait keyed on the same signal still goes through
      await new KeyedWriteQueue().run('k', async () => 'written', signal)
    })
    const r = await runPluginOperation<string>(
      'p1',
      { app: APP, retryPolicy: 'safe', routeProvider: spyProvider('direct'), budgetMs: 800 },
      async (ctx) => {
        // a network-phase wait bounded by the network remaining budget (reserve 100 → ~700ms)
        await abortable(new Promise<never>(() => {}), ctx.signal, ctx.remainingMs())
        return 'unreachable'
      },
      commit
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect((r.error as { code?: string }).code).toBe(CPX_TIMEOUT)
    expect(commit).toHaveBeenCalledOnce()
  })

  it('R2-ISS-032: one signal per budget; networkRemainingMs reaches zero before the signal aborts', async () => {
    const b = createBudget(800) // reserve 100 → network phase ends at 700
    expect(b.networkRemainingMs()).toBeLessThanOrEqual(700)
    expect(b.remainingMs()).toBeGreaterThan(b.networkRemainingMs())
    await new Promise((r) => setTimeout(r, 750))
    expect(b.networkRemainingMs()).toBe(0)
    expect(b.signal.aborted).toBe(false)
    await new Promise((r) => setTimeout(r, 100))
    expect(b.signal.aborted).toBe(true)
    b.dispose()
  })
})

describe('createBudget', () => {
  it('uses a monotonic clock: a clock rollback never extends the budget', () => {
    let t = 1000
    const b = createBudget(1000, () => t)
    t = 1400
    expect(b.remainingMs()).toBe(600)
    t = 1400 // a Date.now() rollback would not move a monotonic clock backwards
    expect(b.remainingMs()).toBe(600)
    t = 2100
    expect(b.remainingMs()).toBe(0)
    b.dispose()
  })

  it('aborts its signal when the budget elapses', async () => {
    const b = createBudget(20)
    expect(b.signal.aborted).toBe(false)
    await new Promise((r) => setTimeout(r, 40))
    expect(b.signal.aborted).toBe(true)
    b.dispose()
  })
})

describe('runPluginOperation', () => {
  it('reads the item and vault, runs fn, then commits the result with the same signal', async () => {
    items.p1 = ITEM
    vaults.p1 = { devicePrivKey: 'k', deviceId: 'd', gateway: GW }
    const commit = vi.fn(async () => {})
    const r = await runPluginOperation<string>(
      'p1',
      { app: APP, retryPolicy: 'safe', routeProvider: spyProvider('direct') },
      async (ctx, item, vault) => {
        expect(item.id).toBe('p1')
        expect(vault.kind).toBe('ok')
        expect(ctx.remainingMs()).toBeGreaterThan(0)
        return 'v'
      },
      commit
    )
    expect(r.ok).toBe(true)
    expect(commit).toHaveBeenCalledWith(
      expect.objectContaining({ ok: true, value: 'v' }),
      ITEM,
      expect.any(AbortSignal)
    )
  })

  it('passes a missing vault through as { kind: "missing" }', async () => {
    items.p1 = ITEM
    const r = await runPluginOperation<string>(
      'p1',
      { app: APP, retryPolicy: 'safe', routeProvider: spyProvider('direct') },
      async (_ctx, _item, vault) => vault.kind,
      async () => {}
    )
    expect(r.ok && r.value).toBe('missing')
  })

  it('throws PluginNotFoundError for an unknown id without committing', async () => {
    const commit = vi.fn(async () => {})
    await expect(
      runPluginOperation('nope', { app: APP, retryPolicy: 'safe' }, async () => 1, commit)
    ).rejects.toBeInstanceOf(PluginNotFoundError)
    expect(commit).not.toHaveBeenCalled()
  })

  it('turns fn errors into ok:false and still commits', async () => {
    items.p1 = ITEM
    const commit = vi.fn(async () => {})
    const r = await runPluginOperation(
      'p1',
      { app: APP, retryPolicy: 'safe', routeProvider: spyProvider('direct') },
      async () => {
        throw new Error('net')
      },
      commit
    )
    expect(r.ok).toBe(false)
    expect(commit).toHaveBeenCalledWith(
      expect.objectContaining({ ok: false }),
      ITEM,
      expect.anything()
    )
  })
})

describe('plugin lock (§0.5)', () => {
  it('aborts the lock wait when the op budget runs out', async () => {
    items.p1 = ITEM
    let release!: () => void
    const holding = withPluginLock(
      'p1',
      () =>
        new Promise<void>((r) => {
          release = r
        })
    )
    const fn = vi.fn(async () => 1)
    const commit = vi.fn(async () => {})
    await expect(
      runPluginOperation('p1', { app: APP, retryPolicy: 'safe', budgetMs: 30 }, fn, commit)
    ).rejects.toThrow('budget exhausted')
    expect(fn).not.toHaveBeenCalled()
    expect(commit).not.toHaveBeenCalled()
    release()
    await holding
  })

  it('a queued op sees the tombstone and gives up without running or committing', async () => {
    items.gone = { ...ITEM, id: 'gone' }
    markPluginRemoved('gone')
    const fn = vi.fn(async () => 1)
    const commit = vi.fn(async () => {})
    await expect(
      runPluginOperation('gone', { app: APP, retryPolicy: 'safe' }, fn, commit)
    ).rejects.toBeInstanceOf(PluginNotFoundError)
    expect(fn).not.toHaveBeenCalled()
    expect(commit).not.toHaveBeenCalled()
  })

  it('skips the commit when the plugin is tombstoned while the op runs', async () => {
    items.late = { ...ITEM, id: 'late' }
    const commit = vi.fn(async () => {})
    const r = await runPluginOperation(
      'late',
      { app: APP, retryPolicy: 'safe', routeProvider: spyProvider('direct') },
      async () => {
        markPluginRemoved('late')
        return 1
      },
      commit
    )
    expect(r.ok).toBe(true)
    expect(commit).not.toHaveBeenCalled()
  })
})

// §1 路由自动回退
describe('route fallback (§1)', () => {
  const PUBLIC = async (): Promise<{ address: string; family: number }[]> => [
    { address: '1.1.1.1', family: 4 }
  ]
  const PRIVATE = async (): Promise<{ address: string; family: number }[]> => [
    { address: '10.0.0.1', family: 4 }
  ]
  const NXDOMAIN = async (): Promise<never> => {
    throw Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' })
  }
  const auto = (first: 'direct' | 'proxy'): RouteProvider =>
    autoRouteProvider(first, async () => PROXY)
  const timeoutErr = (): Error => codedError('Request timed out', CPX_TIMEOUT, 'pre-send')
  const errno = (code: string, phase: 'pre-send' | 'possibly-sent'): Error =>
    codedError(code, code, phase)
  const req = (ctx: OperationContext, url = 'https://gw.front.com/x'): Promise<unknown> =>
    ctx.requester.request(url, { method: 'GET', maxBytes: 10 })
  const base = (over: Record<string, unknown> = {}) => ({
    item: { ...ITEM, routeMode: 'auto' as const },
    app: { subscriptionTimeout: 30000 },
    retryPolicy: 'safe' as const,
    resolveAll: PUBLIC,
    ...over
  })

  it('direct timeout → falls back to proxy → 200 fixes proxy; later requests only use proxy with the full timeout', async () => {
    requestOnce.mockRejectedValueOnce(timeoutErr())
    reply()
    reply()
    const r = await runOperation(base({ routeProvider: auto('direct') }), async (ctx) => {
      await req(ctx)
      await req(ctx, 'https://gw.front.com/y')
    })
    expect(r.ok).toBe(true)
    expect(requestOnce).toHaveBeenCalledTimes(3)
    const [first, second, third] = requestOnce.mock.calls.map(
      (c) => c[1] as Record<string, unknown>
    )
    expect(first.proxy).toBeUndefined()
    expect(first.timeout).toBeLessThanOrEqual(10000)
    expect(second.proxy).toEqual(PROXY)
    expect(second.timeout).toBeLessThanOrEqual(10000)
    expect(third.proxy).toEqual(PROXY)
    expect(third.timeout).toBeGreaterThan(10000)
    expect(r.selectedRoute).toBe('proxy')
  })

  it('direct 503 → no fallback, route fixed to direct', async () => {
    reply('', 503)
    reply('', 200)
    const r = await runOperation(base({ routeProvider: auto('direct') }), async (ctx) => {
      const a = await req(ctx)
      const b = await req(ctx, 'https://gw.front.com/y')
      return [a.status, b.status]
    })
    expect(r.ok && r.value).toEqual([503, 200])
    expect(requestOnce).toHaveBeenCalledTimes(2)
    expect(
      requestOnce.mock.calls.every((c) => (c[1] as { proxy?: unknown }).proxy === undefined)
    ).toBe(true)
    expect(r.selectedRoute).toBe('direct')
  })

  it.each([CPX_REDIRECT_REFUSED, 'CPX_RESPONSE_TOO_LARGE'])(
    'direct %s → no fallback',
    async (code) => {
      requestOnce.mockRejectedValueOnce(codedError(code, code, 'possibly-sent'))
      const r = await runOperation(base({ routeProvider: auto('direct') }), (ctx) => req(ctx))
      expect(r.ok).toBe(false)
      if (!r.ok) expect((r.error as { code?: string }).code).toBe(code)
      expect(requestOnce).toHaveBeenCalledTimes(1)
    }
  )

  it('stickiness is scoped per origin', async () => {
    reply('', 404) // source 1 direct → fixed direct
    requestOnce.mockRejectedValueOnce(timeoutErr()) // source 2 direct times out
    reply() // source 2 proxy ok
    const r = await runOperation(base({ routeProvider: auto('direct') }), async (ctx) => {
      await req(ctx, 'https://one.example/.well-known/cpx-gateway')
      await req(ctx, 'https://two.example/.well-known/cpx-gateway')
    })
    expect(r.ok).toBe(true)
    const calls = requestOnce.mock.calls.map((c) => [c[0], (c[1] as { proxy?: unknown }).proxy])
    expect(calls).toEqual([
      ['https://one.example/.well-known/cpx-gateway', undefined],
      ['https://two.example/.well-known/cpx-gateway', undefined],
      ['https://two.example/.well-known/cpx-gateway', PROXY]
    ])
  })

  describe('pre-send-only (enroll)', () => {
    it('direct timeout → no fallback', async () => {
      requestOnce.mockRejectedValueOnce(timeoutErr())
      const r = await runOperation(
        base({ routeProvider: auto('direct'), retryPolicy: 'pre-send-only' }),
        (ctx) => req(ctx)
      )
      expect(r.ok).toBe(false)
      expect(requestOnce).toHaveBeenCalledTimes(1)
    })
    it('direct ECONNRESET after the request may have been sent → no fallback', async () => {
      requestOnce.mockRejectedValueOnce(errno('ECONNRESET', 'possibly-sent'))
      const r = await runOperation(
        base({ routeProvider: auto('direct'), retryPolicy: 'pre-send-only' }),
        (ctx) => req(ctx)
      )
      expect(r.ok).toBe(false)
      expect(requestOnce).toHaveBeenCalledTimes(1)
    })
    it('direct ECONNREFUSED before sending → falls back to proxy', async () => {
      requestOnce.mockRejectedValueOnce(errno('ECONNREFUSED', 'pre-send'))
      reply()
      const r = await runOperation(
        base({ routeProvider: auto('direct'), retryPolicy: 'pre-send-only' }),
        (ctx) => req(ctx)
      )
      expect(r.ok).toBe(true)
      expect(requestOnce).toHaveBeenCalledTimes(2)
      expect(lastOpts().proxy).toEqual(PROXY)
    })
  })

  describe('preflight guard (§1.4)', () => {
    it('lastGoodRoute=proxy and target resolves to 10.0.0.1 → blocked before any request', async () => {
      const r = await runOperation(
        base({ routeProvider: auto('proxy'), resolveAll: PRIVATE }),
        (ctx) => req(ctx)
      )
      expect(r.ok).toBe(false)
      if (!r.ok) expect((r.error as { code?: string }).code).toBe(CPX_GUARD_REFUSED)
      expect(requestOnce).not.toHaveBeenCalled()
    })
    it('direct guard refusal is terminal: no proxy attempt follows', async () => {
      requestOnce.mockRejectedValueOnce(codedError('refused', CPX_GUARD_REFUSED, 'pre-send'))
      const r = await runOperation(
        base({ routeProvider: auto('direct'), resolveAll: PRIVATE }),
        (ctx) => req(ctx)
      )
      expect(r.ok).toBe(false)
      expect(requestOnce).toHaveBeenCalledTimes(1)
    })
    it('lastGoodRoute=proxy and NXDOMAIN → allowed through the proxy', async () => {
      reply()
      const r = await runOperation(
        base({ routeProvider: auto('proxy'), resolveAll: NXDOMAIN }),
        (ctx) => req(ctx)
      )
      expect(r.ok).toBe(true)
      expect(lastOpts().proxy).toEqual(PROXY)
    })
    it('explicit routeMode=proxy → no preflight, single route', async () => {
      const resolveAll = vi.fn(PRIVATE)
      reply()
      const r = await runOperation(
        base({
          item: { ...ITEM, routeMode: 'proxy' },
          routeProvider: singleRouteProvider('proxy', async () => PROXY),
          resolveAll
        }),
        (ctx) => req(ctx)
      )
      expect(r.ok).toBe(true)
      expect(resolveAll).not.toHaveBeenCalled()
      expect(lastOpts().proxy).toEqual(PROXY)
    })
    it('preflight runs once per origin', async () => {
      const resolveAll = vi.fn(PUBLIC)
      reply()
      reply()
      await runOperation(base({ routeProvider: auto('proxy'), resolveAll }), async (ctx) => {
        await req(ctx)
        await req(ctx, 'https://gw.front.com/y')
      })
      expect(resolveAll).toHaveBeenCalledTimes(1)
    })
  })

  it('budget bounds the whole route fallback: an aborted direct attempt leaves no room for proxy', async () => {
    requestOnce.mockImplementationOnce(
      (_url: string, opts: { signal: AbortSignal }) =>
        new Promise((_, reject) =>
          opts.signal.addEventListener('abort', () =>
            reject(codedError('Request timed out', CPX_TIMEOUT, 'pre-send'))
          )
        )
    )
    const started = Date.now()
    const r = await runOperation(base({ routeProvider: auto('direct'), budgetMs: 1200 }), (ctx) =>
      req(ctx)
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatchObject({ kind: 'transient', message: 'budget exhausted' })
    expect(requestOnce).toHaveBeenCalledTimes(1)
    expect(Date.now() - started).toBeLessThan(1200 + 500)
  })
})

describe('codex-review fixes (operation)', () => {
  it('ISS-003: a preflight resolution that never returns is cut off by the op budget', async () => {
    const started = Date.now()
    const r = await runOperation(
      {
        item: { ...ITEM, routeMode: 'auto' },
        app: { subscriptionTimeout: 30000 },
        retryPolicy: 'safe',
        routeProvider: autoRouteProvider('proxy', async () => PROXY),
        resolveAll: () => new Promise(() => {}),
        budgetMs: 1200
      },
      (ctx) => ctx.requester.request('https://gw.front.com/x', { method: 'GET', maxBytes: 10 })
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatchObject({ kind: 'transient', message: 'budget exhausted' })
    expect(requestOnce).not.toHaveBeenCalled()
    expect(Date.now() - started).toBeLessThan(1200 + 500)
  })
})
