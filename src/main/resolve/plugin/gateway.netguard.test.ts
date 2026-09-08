import { describe, it, expect, vi } from 'vitest'

vi.mock('../../config/plugin', () => ({ getPluginItem: vi.fn() }))
vi.mock('./vault', () => ({ readVault: vi.fn() }))

import { challenge } from './gateway'
import { runOperation } from './operation'
import { singleRouteProvider } from './route'

const ITEM = {
  id: 'p',
  name: 'X',
  loginUrl: 'https://panel.xx.com/oauth/authorize',
  spec: 'cpx-plugin/2',
  status: 'active',
  created: 0,
  updated: 0
} as IPluginItem

// No http-client mock here: the real hardened client + guarded lookup must refuse a private gateway.
describe('gateway network hardening (real client)', () => {
  it('refuses a loopback gateway via guarded lookup', async () => {
    const target = {
      gateway: 'https://localhost',
      endpoints: { enroll: '/e', challenge: '/c', config: '/cfg', revoke: '/r' }
    }
    const r = await runOperation(
      {
        item: ITEM,
        app: { subscriptionTimeout: 2000 },
        retryPolicy: 'safe',
        routeProvider: singleRouteProvider('direct')
      },
      (ctx) => challenge(target, 'DID', ctx.requester)
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatchObject({ kind: 'blocked' })
  })
})
