import { describe, it, expect, beforeEach, vi } from 'vitest'

const profiles: Record<string, string> = {}
const pluginItems: Record<string, IPluginItem> = {}
const vaults: Record<string, IPluginVault> = {}
const unavailableVaults = new Set<string>()
const invalidVaults = new Set<string>()
const unwritableVaults = new Set<string>()
let vaultPreflightUnavailable = false

vi.mock('./vault', () => ({
  writeVault: vi.fn(async (id: string, v: IPluginVault) => {
    if (unwritableVaults.has(id)) throw new Error('Plugin vault is temporarily unavailable')
    vaults[id] = v
  }),
  readVault: vi.fn(async (id: string) => {
    if (unavailableVaults.has(id)) return { kind: 'unavailable' as const }
    if (invalidVaults.has(id)) return { kind: 'invalid' as const }
    return vaults[id] ? { kind: 'ok' as const, vault: vaults[id] } : { kind: 'missing' as const }
  }),
  hasVaultMaterial: vi.fn((id: string) => id in vaults),
  ensureVaultWritable: vi.fn(async () => {
    if (vaultPreflightUnavailable) throw new Error('Plugin vault is temporarily unavailable')
  }),
  updateVault: vi.fn(async (id: string, mutator: (v: IPluginVault) => IPluginVault) => {
    if (!vaults[id]) return false
    vaults[id] = mutator(vaults[id])
    return true
  }),
  removeVault: vi.fn(async (id: string) => {
    delete vaults[id]
  }),
  removeVaultIfDevice: vi.fn(async (id: string, deviceId: string) => {
    if (!vaults[id] || vaults[id].deviceId !== deviceId) return false
    delete vaults[id]
    return true
  }),
  isVaultPersistent: async () => true,
  VaultUnavailableError: class VaultUnavailableError extends Error {}
}))
vi.mock('../../config/plugin', () => ({
  getPluginItem: vi.fn(async (id: string) => pluginItems[id]),
  addPluginItem: vi.fn(async (i: IPluginItem) => {
    pluginItems[i.id] = i
  }),
  updatePluginItem: vi.fn(async (i: IPluginItem) => {
    pluginItems[i.id] = i
  }),
  patchPluginItem: vi.fn(async (id: string, patch: Partial<IPluginItem>) => {
    if (!pluginItems[id]) throw new Error('Plugin not found')
    pluginItems[id] = { ...pluginItems[id], ...patch }
  }),
  removePluginItem: vi.fn(async (id: string) => {
    delete pluginItems[id]
  }),
  getPluginConfig: vi.fn(async () => ({ items: Object.values(pluginItems) })),
  DEFAULT_PLUGIN_INTERVAL_MIN: 1440,
  pluginSchedule: (item?: IPluginItem) => ({
    interval: item?.interval ?? 1440,
    autoUpdate: item?.autoUpdate ?? true
  })
}))
vi.mock('../../config/profile', () => ({
  upsertPluginProfile: vi.fn(async (meta: { profileId: string }, content: string) => {
    profiles[meta.profileId] = content
  }),
  removePluginProfileContent: vi.fn(async (pid: string) => {
    delete profiles[pid]
  }),
  isPluginProfileInvalidError: (e: unknown) =>
    typeof e === 'object' &&
    e !== null &&
    (e as { code?: unknown }).code === 'PLUGIN_PROFILE_INVALID',
  syncPluginProfileSchedule: vi.fn(async () => {})
}))
vi.mock('../../config/app', () => ({
  getAppConfig: vi.fn(async () => ({ subscriptionTimeout: 5000 }))
}))
vi.mock('../../window', () => ({ mainWindow: null }))
vi.mock('../../config/controledMihomo', () => ({
  getControledMihomoConfig: vi.fn(async () => ({ 'mixed-port': 7890 }))
}))
const requestOnce = vi.fn()
vi.mock('./http-client', () => ({ requestOnce: (...a: unknown[]) => requestOnce(...a) }))
// 路由预检不得依赖真实 DNS：所有目标都视为公网
vi.mock('./net-guard', async (importOriginal) => {
  const real = await importOriginal<typeof import('./net-guard')>()
  return {
    ...real,
    resolveAllPublicOrThrow: async () => [{ address: '1.1.1.1', family: 4 }]
  }
})

const discoverGateway = vi.fn()
vi.mock('./discovery', () => ({
  discoverGateway: (...a: unknown[]) => discoverGateway(...a),
  originOf: (u: string) => new URL(u).origin
}))
const browserLogin = vi.fn()
vi.mock('./oauth', () => ({
  browserLogin: (...a: unknown[]) => browserLogin(...a),
  CLIENT_ID: 'mihomo-party'
}))
const enroll = vi.fn()
const fetchConfig = vi.fn()
const revoke = vi.fn()
vi.mock('./gateway', async (importOriginal) => {
  const real = await importOriginal<typeof import('./gateway')>()
  return {
    GatewayError: real.GatewayError,
    enroll: (...a: unknown[]) => enroll(...a),
    fetchConfig: (...a: unknown[]) => fetchConfig(...a),
    revoke: (...a: unknown[]) => revoke(...a)
  }
})

import { readFileSync } from 'fs'
import { join } from 'path'
import { createPrivateKey, sign } from 'crypto'
import { GatewayError } from './gateway'
import { buildDiscoverySignInput } from './discovery-sig'
import { sha256Hex } from './encoding'
import { readVault as readVaultMock } from './vault'
import {
  previewPlugin,
  installPlugin,
  loginPlugin,
  updatePluginProfile,
  auditPluginVault,
  removePlugin,
  removePluginForProfile,
  patchPluginItem
} from './index'
import { getAppConfig } from '../../config/app'

const CLASH =
  'proxies:\n  - {name: a, type: ss, server: 1.1.1.1, port: 8388, cipher: aes-128-gcm, password: x}\n'
const WK = {
  spec: 'cpx-plugin/2',
  gateways: ['https://gw.front.com'],
  endpoints: { enroll: '/enroll', challenge: '/challenge', config: '/config', revoke: '/revoke' }
}
const GW1 = 'https://gw.front.com'
const GW2 = 'https://gw2.front.com'
const GW3 = 'https://gw3.front.com'
function state(gateways: string[], lastGood?: string): IPluginGatewayState {
  return { gateway: lastGood ?? gateways[0], gateways, endpoints: WK.endpoints, lastGood }
}
function file(extra: Record<string, unknown> = {}): string {
  return Buffer.from(
    JSON.stringify({
      magic: 'CPXF',
      v: 2,
      spec: 'cpx-plugin/2',
      loginUrl: 'https://panel.xx.com/oauth/authorize',
      provider: { name: 'XX', site: 'https://xx.com' },
      ...extra
    }),
    'utf-8'
  ).toString('base64')
}

beforeEach(() => {
  for (const k of Object.keys(profiles)) delete profiles[k]
  for (const k of Object.keys(pluginItems)) delete pluginItems[k]
  for (const k of Object.keys(vaults)) delete vaults[k]
  unavailableVaults.clear()
  invalidVaults.clear()
  unwritableVaults.clear()
  vaultPreflightUnavailable = false
  discoverGateway.mockReset().mockResolvedValue(WK)
  browserLogin.mockReset().mockResolvedValue({
    code: 'C',
    verifier: 'V',
    redirectUri: 'http://127.0.0.1:1/callback'
  })
  enroll.mockReset().mockResolvedValue(undefined)
  fetchConfig.mockReset().mockResolvedValue({ yaml: CLASH })
  revoke.mockReset().mockResolvedValue(undefined)
  requestOnce.mockReset()
})

describe('previewPlugin', () => {
  it('returns the display subset without creating records or touching network', async () => {
    const p = await previewPlugin(file())
    expect(p.name).toBe('XX')
    expect(p.loginUrl).toBe('https://panel.xx.com/oauth/authorize')
    expect(Object.keys(pluginItems)).toHaveLength(0)
    expect(discoverGateway).not.toHaveBeenCalled()
  })
  it('rejects an invalid file', async () => {
    await expect(previewPlugin(Buffer.from('{bad', 'utf-8').toString('base64'))).rejects.toThrow()
  })
})

describe('installPlugin', () => {
  it('creates a needs-login record with no profileId and no network', async () => {
    const item = await installPlugin(file())
    expect(item.status).toBe('needs-login')
    expect(item.profileId).toBeUndefined()
    expect(item.loginUrl).toBe('https://panel.xx.com/oauth/authorize')
    expect(discoverGateway).not.toHaveBeenCalled()
    expect(browserLogin).not.toHaveBeenCalled()
  })
})

describe('loginPlugin', () => {
  it('discovers, generates device, browser-logs-in, enrolls, writes vault, fetches profile, active', async () => {
    const item = await installPlugin(file())
    await loginPlugin(item.id)
    const rec = pluginItems[item.id]
    expect(rec.status).toBe('active')
    expect(rec.profileId).toBeDefined()
    expect(profiles[rec.profileId!]).toBe(CLASH)
    const vault = vaults[item.id]
    expect(Buffer.from(vault.devicePrivKey, 'base64')).toHaveLength(32)
    expect(vault.gateway.gateway).toBe('https://gw.front.com')
    expect(vault.gateway.gateways).toEqual(['https://gw.front.com'])
    expect(vault.gateway.lastGood).toBe('https://gw.front.com')
    expect(enroll).toHaveBeenCalledWith(
      expect.objectContaining({ gateway: 'https://gw.front.com' }),
      expect.objectContaining({ code: 'C', code_verifier: 'V', client_id: 'mihomo-party' }),
      expect.any(Object)
    )
  })

  it('does not start OAuth/enroll while the vault backend is temporarily unavailable', async () => {
    const item = await installPlugin(file())
    // 真实路径：新插件尚无 vault，readVault 返回 missing，随后由写入预检拦截。
    vaultPreflightUnavailable = true

    await expect(loginPlugin(item.id)).rejects.toThrow('PLUGIN_LOGIN_FAILED')
    expect(browserLogin).not.toHaveBeenCalled()
    expect(enroll).not.toHaveBeenCalled()
  })

  it('best-effort revokes a newly enrolled device when vault persistence fails', async () => {
    const item = await installPlugin(file())
    unwritableVaults.add(item.id)

    await expect(loginPlugin(item.id)).rejects.toThrow('PLUGIN_LOGIN_FAILED')
    expect(enroll).toHaveBeenCalledOnce()
    expect(revoke).toHaveBeenCalledWith(
      expect.objectContaining({ gateway: WK.gateways[0] }),
      expect.objectContaining({ deviceId: expect.any(String), privKeyB64: expect.any(String) }),
      expect.any(Object)
    )
    expect(pluginItems[item.id].status).toBe('needs-login')
  })

  it('re-login (reauth) after restart works from the persisted loginUrl alone (no reimport)', async () => {
    const item = await installPlugin(file())
    await loginPlugin(item.id)
    delete vaults[item.id]
    pluginItems[item.id] = { ...pluginItems[item.id], status: 'needs-reauth' }
    await loginPlugin(item.id)
    expect(pluginItems[item.id].status).toBe('active')
    expect(vaults[item.id]).toBeDefined()
  })

  // 设备复用仅限 needs-login 的“孤儿设备”（上次 enroll 成功但首份订阅拉取失败）
  it('reuses an orphaned device (needs-login + vault) without browser/enroll', async () => {
    const item = await installPlugin(file()) // needs-login, no vault
    const dev = {
      devicePrivKey: Buffer.alloc(32, 1).toString('base64'),
      deviceId: '11111111-1111-4111-8111-111111111111'
    }
    vaults[item.id] = { ...dev, gateway: state(WK.gateways) }
    browserLogin.mockClear()
    enroll.mockClear()
    discoverGateway.mockClear()
    await loginPlugin(item.id)
    expect(browserLogin).not.toHaveBeenCalled()
    expect(enroll).not.toHaveBeenCalled()
    expect(discoverGateway).not.toHaveBeenCalled()
    expect(fetchConfig).toHaveBeenCalled()
    expect(vaults[item.id].devicePrivKey).toBe(dev.devicePrivKey)
    expect(pluginItems[item.id].status).toBe('active')
  })

  it('falls back to browser login + new device if the orphaned device is revoked', async () => {
    const item = await installPlugin(file())
    const dev = {
      devicePrivKey: Buffer.alloc(32, 2).toString('base64'),
      deviceId: '22222222-2222-4222-8222-222222222222'
    }
    vaults[item.id] = { ...dev, gateway: state(WK.gateways) }
    browserLogin.mockClear()
    enroll.mockClear()
    fetchConfig
      .mockRejectedValueOnce(new GatewayError('revoked', 'revoked')) // reuse attempt
      .mockResolvedValueOnce({ yaml: CLASH }) // full-flow first fetch
    await loginPlugin(item.id)
    expect(browserLogin).toHaveBeenCalled()
    expect(enroll).toHaveBeenCalled()
    expect(pluginItems[item.id].status).toBe('active')
    expect(vaults[item.id].devicePrivKey).not.toBe(dev.devicePrivKey)
  })

  // spec §9：显式重新登录（needs-reauth）必须再走浏览器登录 + 新设备，即便 vault 仍在也不复用
  it('explicit re-login (needs-reauth) does a fresh browser login + new device even with a vault', async () => {
    const item = await installPlugin(file())
    await loginPlugin(item.id) // active, vault written
    const devKeyBefore = vaults[item.id].devicePrivKey
    pluginItems[item.id] = { ...pluginItems[item.id], status: 'needs-reauth' } // vault still present
    browserLogin.mockClear()
    enroll.mockClear()
    fetchConfig.mockClear()
    await loginPlugin(item.id)
    expect(browserLogin).toHaveBeenCalled()
    expect(enroll).toHaveBeenCalled()
    expect(pluginItems[item.id].status).toBe('active')
    expect(vaults[item.id].devicePrivKey).not.toBe(devKeyBefore)
  })

  it('sanitizes login errors (no gateway host / network detail leaks to the caller)', async () => {
    const item = await installPlugin(file())
    fetchConfig.mockRejectedValueOnce(
      new GatewayError('unreachable', 'getaddrinfo ENOTFOUND gw.secret.host')
    )
    const err = (await loginPlugin(item.id).catch((e) => e)) as Error
    expect(err.message).toBe('PLUGIN_LOGIN_NETWORK')
    expect(err.message).not.toContain('gw.secret.host')
  })
})

describe('updatePluginProfile', () => {
  it('signed silent fetch refreshes the profile and clears failure state', async () => {
    const item = await installPlugin(file())
    await loginPlugin(item.id)
    fetchConfig.mockResolvedValueOnce({
      yaml: 'proxies: [{name: b, type: ss, server: 2.2.2.2, port: 1, cipher: aes-128-gcm, password: y}]\n'
    })
    await updatePluginProfile(item.id)
    expect(pluginItems[item.id].status).toBe('active')
    expect(pluginItems[item.id].failureCount ?? 0).toBe(0)
  })

  it('revoked → needs-reauth (no backoff)', async () => {
    const item = await installPlugin(file())
    await loginPlugin(item.id)
    fetchConfig.mockRejectedValueOnce(new GatewayError('revoked', 'revoked'))
    await updatePluginProfile(item.id)
    expect(pluginItems[item.id].status).toBe('needs-reauth')
  })

  it('transient failure keeps old profile + sets backoff', async () => {
    const item = await installPlugin(file())
    await loginPlugin(item.id)
    const before = profiles[pluginItems[item.id].profileId!]
    fetchConfig.mockRejectedValueOnce(new GatewayError('transient', 'timeout'))
    await updatePluginProfile(item.id)
    expect(pluginItems[item.id].status).toBe('active')
    expect(pluginItems[item.id].failureCount).toBe(1)
    expect(pluginItems[item.id].nextRetryAt).toBeGreaterThan(Date.now())
    expect(profiles[pluginItems[item.id].profileId!]).toBe(before)
  })

  it('temporary vault unavailability keeps the plugin active and backs off', async () => {
    const item = await installPlugin(file())
    await loginPlugin(item.id)
    unavailableVaults.add(item.id)
    fetchConfig.mockClear()

    await updatePluginProfile(item.id)

    expect(pluginItems[item.id].status).toBe('active')
    expect(pluginItems[item.id].lastUpdateErrorType).toBe('transient')
    expect(pluginItems[item.id].failureCount).toBe(1)
    expect(pluginItems[item.id].nextRetryAt).toBeGreaterThan(Date.now())
    expect(fetchConfig).not.toHaveBeenCalled()
  })

  it('backoff success clears failure state', async () => {
    const item = await installPlugin(file())
    await loginPlugin(item.id)
    pluginItems[item.id] = {
      ...pluginItems[item.id],
      failureCount: 2,
      nextRetryAt: Date.now() - 1,
      lastUpdateErrorType: 'transient'
    }
    await updatePluginProfile(item.id)
    expect(pluginItems[item.id].failureCount).toBe(0)
    expect(pluginItems[item.id].lastUpdateErrorType).toBeUndefined()
  })

  it('respects nextRetryAt unless forced', async () => {
    const item = await installPlugin(file())
    await loginPlugin(item.id)
    pluginItems[item.id] = { ...pluginItems[item.id], nextRetryAt: Date.now() + 60000 }
    fetchConfig.mockClear()
    await updatePluginProfile(item.id)
    expect(fetchConfig).not.toHaveBeenCalled()
    await updatePluginProfile(item.id, true)
    expect(fetchConfig).toHaveBeenCalled()
  })

  it('vault missing → needs-reauth', async () => {
    const item = await installPlugin(file())
    await loginPlugin(item.id)
    delete vaults[item.id]
    await updatePluginProfile(item.id)
    expect(pluginItems[item.id].status).toBe('needs-reauth')
  })

  it('permanently invalid vault → needs-reauth', async () => {
    const item = await installPlugin(file())
    await loginPlugin(item.id)
    invalidVaults.add(item.id)

    await updatePluginProfile(item.id)
    expect(pluginItems[item.id].status).toBe('needs-reauth')
  })

  it('corrupt active record (no profileId) → needs-reauth, never writes undefined.yaml', async () => {
    const item = await installPlugin(file())
    pluginItems[item.id] = { ...pluginItems[item.id], status: 'active', profileId: undefined }
    fetchConfig.mockClear()
    await updatePluginProfile(item.id)
    expect(pluginItems[item.id].status).toBe('needs-reauth')
    expect(fetchConfig).not.toHaveBeenCalled()
  })

  it('re-discovers and retries once on a retired gateway', async () => {
    const item = await installPlugin(file())
    await loginPlugin(item.id)
    discoverGateway.mockClear()
    fetchConfig
      .mockRejectedValueOnce(new GatewayError('retired', 'gone'))
      .mockResolvedValueOnce({ yaml: CLASH })
    discoverGateway.mockResolvedValueOnce({ ...WK, gateways: ['https://gw2.front.com'] })
    await updatePluginProfile(item.id)
    expect(discoverGateway).toHaveBeenCalledTimes(1)
    expect(vaults[item.id].gateway.gateway).toBe('https://gw2.front.com')
    expect(pluginItems[item.id].status).toBe('active')
  })

  it('re-discovers and retries once on an unreachable gateway (dead/retired domain)', async () => {
    const item = await installPlugin(file())
    await loginPlugin(item.id)
    discoverGateway.mockClear()
    fetchConfig
      .mockRejectedValueOnce(new GatewayError('unreachable', 'ENOTFOUND'))
      .mockResolvedValueOnce({ yaml: CLASH })
    discoverGateway.mockResolvedValueOnce({ ...WK, gateways: ['https://gw3.front.com'] })
    await updatePluginProfile(item.id)
    expect(discoverGateway).toHaveBeenCalledTimes(1)
    expect(vaults[item.id].gateway.gateway).toBe('https://gw3.front.com')
    expect(pluginItems[item.id].status).toBe('active')
  })

  it('does nothing for needs-login / needs-reauth statuses', async () => {
    const item = await installPlugin(file())
    fetchConfig.mockClear()
    await updatePluginProfile(item.id)
    expect(fetchConfig).not.toHaveBeenCalled()
  })
})

describe('auditPluginVault', () => {
  it('checks material presence without decrypting an existing vault', async () => {
    const item = await installPlugin(file())
    await loginPlugin(item.id)
    vi.mocked(readVaultMock).mockClear()

    await auditPluginVault(item.id)

    expect(readVaultMock).not.toHaveBeenCalled()
    expect(pluginItems[item.id].status).toBe('active')
  })

  it('marks an active plugin with a missing vault as needs-reauth', async () => {
    const item = await installPlugin(file())
    await loginPlugin(item.id)
    delete vaults[item.id]
    await auditPluginVault(item.id)
    expect(pluginItems[item.id].status).toBe('needs-reauth')
  })
  it('leaves a needs-login plugin alone', async () => {
    const item = await installPlugin(file())
    await auditPluginVault(item.id)
    expect(pluginItems[item.id].status).toBe('needs-login')
  })
})

describe('removePlugin', () => {
  it('best-effort revokes then removes profile + record + vault', async () => {
    const item = await installPlugin(file())
    await loginPlugin(item.id)
    const pid = pluginItems[item.id].profileId!
    await removePlugin(item.id)
    expect(revoke).toHaveBeenCalled()
    expect(pluginItems[item.id]).toBeUndefined()
    expect(vaults[item.id]).toBeUndefined()
    expect(profiles[pid]).toBeUndefined()
  })
  it('completes local deletion even if revoke fails', async () => {
    const item = await installPlugin(file())
    await loginPlugin(item.id)
    revoke.mockRejectedValueOnce(new GatewayError('transient', 'net'))
    await removePlugin(item.id)
    expect(pluginItems[item.id]).toBeUndefined()
    expect(vaults[item.id]).toBeUndefined()
  })
  it('re-discovers and revokes against the new gateway when the cached one is retired', async () => {
    const item = await installPlugin(file())
    await loginPlugin(item.id)
    discoverGateway.mockClear()
    revoke
      .mockRejectedValueOnce(new GatewayError('retired', 'gone'))
      .mockResolvedValueOnce(undefined)
    discoverGateway.mockResolvedValueOnce({ ...WK, gateways: ['https://gw4.front.com'] })
    await removePlugin(item.id)
    expect(discoverGateway).toHaveBeenCalledTimes(1)
    expect(revoke).toHaveBeenCalledTimes(2)
    expect(pluginItems[item.id]).toBeUndefined()
    expect(vaults[item.id]).toBeUndefined()
  })
})

// §0.5 插件级串行与删除临界区
describe('plugin lock', () => {
  function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void } {
    let resolve!: (v: T) => void
    const promise = new Promise<T>((r) => {
      resolve = r
    })
    return { promise, resolve }
  }
  const NEW_CLASH =
    'proxies: [{name: new, type: ss, server: 3.3.3.3, port: 1, cipher: aes-128-gcm, password: z}]\n'

  it('serializes a slow older update and a fast newer one; the newer profile wins', async () => {
    const item = await installPlugin(file())
    await loginPlugin(item.id)
    const slow = deferred<{ yaml: string }>()
    fetchConfig.mockReturnValueOnce(slow.promise).mockResolvedValueOnce({ yaml: NEW_CLASH })
    const first = updatePluginProfile(item.id, true)
    const second = updatePluginProfile(item.id, true)
    await new Promise((r) => setTimeout(r, 10))
    expect(fetchConfig).toHaveBeenCalledTimes(2) // 1 from login + only the first update so far
    slow.resolve({ yaml: CLASH })
    await Promise.all([first, second])
    expect(fetchConfig).toHaveBeenCalledTimes(3)
    expect(profiles[pluginItems[item.id].profileId!]).toBe(NEW_CLASH)
  })

  it('removePlugin during an update: the update abandons its commit, nothing is resurrected', async () => {
    const item = await installPlugin(file())
    await loginPlugin(item.id)
    const pid = pluginItems[item.id].profileId!
    const slow = deferred<{ yaml: string }>()
    fetchConfig.mockReturnValueOnce(slow.promise)
    const update = updatePluginProfile(item.id, true)
    await new Promise((r) => setTimeout(r, 5))
    const removal = removePlugin(item.id)
    await new Promise((r) => setTimeout(r, 5))
    expect(pluginItems[item.id]).toBeDefined() // removal is queued behind the running update
    slow.resolve({ yaml: NEW_CLASH })
    await Promise.all([update, removal])
    expect(pluginItems[item.id]).toBeUndefined()
    expect(vaults[item.id]).toBeUndefined()
    expect(profiles[pid]).not.toBe(NEW_CLASH)
    // a later update sees the tombstone and does nothing
    fetchConfig.mockClear()
    await updatePluginProfile(item.id, true)
    expect(fetchConfig).not.toHaveBeenCalled()
    expect(vaults[item.id]).toBeUndefined()
  })

  it('removeProfileItem cascade during an update behaves the same and does not self-lock', async () => {
    const item = await installPlugin(file())
    await loginPlugin(item.id)
    const slow = deferred<{ yaml: string }>()
    fetchConfig.mockReturnValueOnce(slow.promise)
    const update = updatePluginProfile(item.id, true)
    await new Promise((r) => setTimeout(r, 5))
    const removal = removePluginForProfile(item.id, pluginItems[item.id].profileId!)
    slow.resolve({ yaml: NEW_CLASH })
    await Promise.all([update, removal])
    expect(revoke).toHaveBeenCalled()
    expect(pluginItems[item.id]).toBeUndefined()
    expect(vaults[item.id]).toBeUndefined()
  })

  it('removePlugin while a login waits on the browser: enroll result is discarded and revoked', async () => {
    const item = await installPlugin(file())
    const browser = deferred<{ code: string; verifier: string; redirectUri: string }>()
    browserLogin.mockReturnValueOnce(browser.promise)
    const login = loginPlugin(item.id)
    await new Promise((r) => setTimeout(r, 5))
    await removePlugin(item.id)
    browser.resolve({ code: 'C', verifier: 'V', redirectUri: 'http://127.0.0.1:1/callback' })
    await expect(login).rejects.toThrow('PLUGIN_LOGIN_FAILED')
    expect(vaults[item.id]).toBeUndefined()
    expect(pluginItems[item.id]).toBeUndefined()
  })

  it('rejects a second concurrent login for the same plugin', async () => {
    const item = await installPlugin(file())
    const browser = deferred<{ code: string; verifier: string; redirectUri: string }>()
    browserLogin.mockReturnValueOnce(browser.promise)
    const first = loginPlugin(item.id)
    await new Promise((r) => setTimeout(r, 5))
    await expect(loginPlugin(item.id)).rejects.toThrow('PLUGIN_LOGIN_FAILED')
    browser.resolve({ code: 'C', verifier: 'V', redirectUri: 'http://127.0.0.1:1/callback' })
    await first
    expect(pluginItems[item.id].status).toBe('active')
  })
})

// §1 路由模式、lastGoodRoute 与失败原因
describe('route mode persistence (§1)', () => {
  it('installPlugin writes routeMode from the global default and mirrors useProxy', async () => {
    vi.mocked(getAppConfig).mockResolvedValueOnce({
      subscriptionTimeout: 5000,
      pluginUseProxy: true
    })
    const viaProxy = await installPlugin(file())
    expect(viaProxy.routeMode).toBe('proxy')
    expect(viaProxy.useProxy).toBe(true)
    const auto = await installPlugin(file())
    expect(auto.routeMode).toBe('auto')
    expect(auto.useProxy).toBe(false)
  })

  it('patchPluginItem mirrors useProxy whenever routeMode changes', async () => {
    const item = await installPlugin(file())
    await patchPluginItem(item.id, { routeMode: 'proxy' })
    expect(pluginItems[item.id].useProxy).toBe(true)
    await patchPluginItem(item.id, { routeMode: 'direct' })
    expect(pluginItems[item.id].useProxy).toBe(false)
    await patchPluginItem(item.id, { interval: 5 })
    expect(pluginItems[item.id].useProxy).toBe(false)
  })

  it('commit records lastGoodRoute=proxy after a direct timeout fell back to the proxy (auto mode)', async () => {
    const item = await installPlugin(file())
    await loginPlugin(item.id)
    // 让 fetchConfig 真正经过路由执行器：direct 超时 → proxy 200
    fetchConfig.mockImplementationOnce(async (t: { gateway: string }, _c: unknown, requester) => {
      await (requester as { request: (url: string, opts: unknown) => Promise<unknown> }).request(
        t.gateway + '/config',
        {
          method: 'POST',
          maxBytes: 1
        }
      )
      return { yaml: CLASH }
    })
    requestOnce
      .mockRejectedValueOnce(
        Object.assign(new Error('timeout'), { code: 'CPX_TIMEOUT', phase: 'pre-send' })
      )
      .mockResolvedValueOnce({ status: 200, headers: {}, body: '' })
    await updatePluginProfile(item.id, true)
    expect(pluginItems[item.id].status).toBe('active')
    expect(pluginItems[item.id].lastGoodRoute).toBe('proxy')
    expect(requestOnce).toHaveBeenCalledTimes(2)
    expect((requestOnce.mock.calls[1][1] as { proxy?: unknown }).proxy).toBeDefined()
  })

  it('does not record lastGoodRoute in an explicit mode', async () => {
    const item = await installPlugin(file())
    await loginPlugin(item.id)
    pluginItems[item.id] = { ...pluginItems[item.id], routeMode: 'direct' }
    fetchConfig.mockImplementationOnce(async (t: { gateway: string }, _c: unknown, requester) => {
      await (requester as { request: (url: string, opts: unknown) => Promise<unknown> }).request(
        t.gateway + '/config',
        {
          method: 'POST',
          maxBytes: 1
        }
      )
      return { yaml: CLASH }
    })
    requestOnce.mockResolvedValueOnce({ status: 200, headers: {}, body: '' })
    await updatePluginProfile(item.id, true)
    expect(pluginItems[item.id].lastGoodRoute).toBeUndefined()
  })

  it('a field patched externally during the op is not overwritten by the commit', async () => {
    const item = await installPlugin(file())
    await loginPlugin(item.id)
    fetchConfig.mockImplementationOnce(async () => {
      pluginItems[item.id] = { ...pluginItems[item.id], interval: 99 }
      return { yaml: CLASH }
    })
    await updatePluginProfile(item.id, true)
    expect(pluginItems[item.id].interval).toBe(99)
    expect(pluginItems[item.id].status).toBe('active')
  })

  it.each([
    ['blocked', new GatewayError('blocked', 'refused'), 'blocked'],
    ['unreachable', new GatewayError('unreachable', 'ENOTFOUND'), 'network'],
    ['transient without status', new GatewayError('transient', 'timeout'), 'network'],
    ['transient with status', new GatewayError('transient', '503', 503), 'server']
  ] as const)('%s failure → backoff with lastUpdateErrorReason=%s', async (_n, err, reason) => {
    const item = await installPlugin(file())
    await loginPlugin(item.id)
    // unreachable 会触发一次重发现并重试，因此两次尝试都失败
    fetchConfig.mockRejectedValueOnce(err).mockRejectedValueOnce(err)
    await updatePluginProfile(item.id, true)
    fetchConfig.mockReset().mockResolvedValue({ yaml: CLASH })
    const rec = pluginItems[item.id]
    expect(rec.status).toBe('active')
    expect(rec.lastUpdateErrorType).toBe('transient')
    expect(rec.lastUpdateErrorReason).toBe(reason)
    expect(rec.failureCount).toBe(1)
    fetchConfig.mockResolvedValueOnce({ yaml: CLASH })
    await updatePluginProfile(item.id, true)
    expect(pluginItems[item.id].lastUpdateErrorReason).toBeUndefined()
  })

  it('blocked passes straight through gateway recovery (no rediscovery)', async () => {
    const item = await installPlugin(file())
    await loginPlugin(item.id)
    discoverGateway.mockClear()
    fetchConfig.mockRejectedValueOnce(new GatewayError('blocked', 'refused'))
    await updatePluginProfile(item.id, true)
    expect(discoverGateway).not.toHaveBeenCalled()
    expect(pluginItems[item.id].lastUpdateErrorReason).toBe('blocked')
  })
})

// §2 多网关切换 + 一次重发现 + 登录流程重组
describe('gateway recovery (§2.4)', () => {
  async function activeWith(gateways: string[], lastGood?: string): Promise<string> {
    const item = await installPlugin(file())
    await loginPlugin(item.id)
    vaults[item.id] = { ...vaults[item.id], gateway: state(gateways, lastGood) }
    discoverGateway.mockClear()
    fetchConfig.mockReset()
    return item.id
  }
  const targetsTried = (): string[] =>
    fetchConfig.mock.calls.map((c) => (c[0] as { gateway: string }).gateway)
  const NEW_CLASH =
    'proxies: [{name: gw2, type: ss, server: 4.4.4.4, port: 1, cipher: aes-128-gcm, password: q}]\n'

  it('gw1 timeout, gw2 ok → content from gw2 and lastGood=gw2 (no rediscovery)', async () => {
    const id = await activeWith([GW1, GW2])
    fetchConfig
      .mockRejectedValueOnce(new GatewayError('transient', 'timeout'))
      .mockResolvedValueOnce({ yaml: NEW_CLASH })
    await updatePluginProfile(id, true)
    expect(targetsTried()).toEqual([GW1, GW2])
    expect(discoverGateway).not.toHaveBeenCalled()
    expect(vaults[id].gateway.lastGood).toBe(GW2)
    expect(vaults[id].gateway.gateway).toBe(GW2)
    expect(vaults[id].gateway.gateways).toEqual([GW1, GW2])
    expect(profiles[pluginItems[id].profileId!]).toBe(NEW_CLASH)
  })

  it('starts from lastGood, then the rest in order', async () => {
    const id = await activeWith([GW1, GW2, GW3], GW2)
    fetchConfig
      .mockRejectedValueOnce(new GatewayError('unreachable', 'x'))
      .mockRejectedValueOnce(new GatewayError('unreachable', 'x'))
      .mockResolvedValueOnce({ yaml: CLASH })
    await updatePluginProfile(id, true)
    expect(targetsTried()).toEqual([GW2, GW1, GW3])
    expect(vaults[id].gateway.lastGood).toBe(GW3)
  })

  it('gw1 503 → does not try gw2', async () => {
    const id = await activeWith([GW1, GW2])
    fetchConfig.mockRejectedValueOnce(new GatewayError('transient', '503', 503))
    await updatePluginProfile(id, true)
    expect(targetsTried()).toEqual([GW1])
    expect(pluginItems[id].lastUpdateErrorReason).toBe('server')
  })

  it('gw1 revoked → does not try gw2; needs-reauth', async () => {
    const id = await activeWith([GW1, GW2])
    fetchConfig.mockRejectedValueOnce(new GatewayError('revoked', 'revoked'))
    await updatePluginProfile(id, true)
    expect(targetsTried()).toEqual([GW1])
    expect(pluginItems[id].status).toBe('needs-reauth')
  })

  it('all three time out → rediscover once; same list → nothing new → ok:false with the rediscovered list committed', async () => {
    const id = await activeWith([GW1, GW2, GW3])
    fetchConfig.mockRejectedValue(new GatewayError('transient', 'timeout'))
    discoverGateway.mockResolvedValueOnce({ ...WK, gateways: [GW1, GW2, GW3] })
    await updatePluginProfile(id, true)
    expect(targetsTried()).toEqual([GW1, GW2, GW3])
    expect(discoverGateway).toHaveBeenCalledTimes(1)
    expect(pluginItems[id].lastUpdateErrorType).toBe('transient')
    expect(vaults[id].gateway.gateways).toEqual([GW1, GW2, GW3])
    expect(vaults[id].gateway.lastGood).toBeUndefined()
  })

  it('rediscovered list with a new origin → only the new origin is tried', async () => {
    const id = await activeWith([GW1, GW2])
    fetchConfig
      .mockRejectedValueOnce(new GatewayError('unreachable', 'x'))
      .mockRejectedValueOnce(new GatewayError('unreachable', 'x'))
      .mockResolvedValueOnce({ yaml: CLASH })
    discoverGateway.mockResolvedValueOnce({ ...WK, gateways: [GW1, GW3] })
    await updatePluginProfile(id, true)
    expect(targetsTried()).toEqual([GW1, GW2, GW3])
    expect(vaults[id].gateway.gateways).toEqual([GW1, GW3])
    expect(vaults[id].gateway.lastGood).toBe(GW3)
    expect(pluginItems[id].status).toBe('active')
  })

  it('same origin with a changed config path counts as a new target', async () => {
    const id = await activeWith([GW1])
    fetchConfig
      .mockRejectedValueOnce(new GatewayError('retired', 'gone'))
      .mockResolvedValueOnce({ yaml: CLASH })
    discoverGateway.mockResolvedValueOnce({
      ...WK,
      gateways: [GW1],
      endpoints: { ...WK.endpoints, config: '/v2/config' }
    })
    await updatePluginProfile(id, true)
    expect(fetchConfig).toHaveBeenCalledTimes(2)
    expect(
      (fetchConfig.mock.calls[1][0] as { endpoints: { config: string } }).endpoints.config
    ).toBe('/v2/config')
    expect(vaults[id].gateway.endpoints.config).toBe('/v2/config')
  })

  it('R2-ISS-004: an equivalent config path spelling is the same target, not a second attempt', async () => {
    const id = await activeWith([GW1])
    fetchConfig.mockRejectedValueOnce(new GatewayError('retired', 'gone'))
    discoverGateway.mockResolvedValueOnce({
      ...WK,
      gateways: [GW1],
      endpoints: { ...WK.endpoints, config: '/v1/../config' }
    })
    await updatePluginProfile(id, true)
    expect(fetchConfig).toHaveBeenCalledTimes(1)
    expect(pluginItems[id].lastUpdateErrorType).toBe('transient')
  })

  it('rediscovery ok but the new gateway returns 503 → ok:false, new list still committed and used next time', async () => {
    const id = await activeWith([GW1])
    fetchConfig
      .mockRejectedValueOnce(new GatewayError('unreachable', 'x'))
      .mockRejectedValueOnce(new GatewayError('transient', '503', 503))
    discoverGateway.mockResolvedValueOnce({ ...WK, gateways: [GW2] })
    await updatePluginProfile(id, true)
    expect(pluginItems[id].lastUpdateErrorReason).toBe('server')
    expect(vaults[id].gateway.gateways).toEqual([GW2])
    fetchConfig.mockReset().mockResolvedValueOnce({ yaml: CLASH })
    await updatePluginProfile(id, true)
    expect(targetsTried()).toEqual([GW2])
    expect(pluginItems[id].status).toBe('active')
  })

  describe('enroll (pre-send-only) gateway switching', () => {
    async function freshWith(gateways: string[]): Promise<string> {
      const item = await installPlugin(file())
      discoverGateway.mockResolvedValue({ ...WK, gateways })
      enroll.mockReset()
      return item.id
    }
    const enrollTargets = (): string[] =>
      enroll.mock.calls.map((c) => (c[0] as { gateway: string }).gateway)

    it('timeout → no gateway switch, login fails', async () => {
      const id = await freshWith([GW1, GW2])
      enroll.mockRejectedValueOnce(new GatewayError('transient', 'timeout'))
      await expect(loginPlugin(id)).rejects.toThrow('PLUGIN_LOGIN_NETWORK')
      expect(enrollTargets()).toEqual([GW1])
    })
    it('pre-send ECONNREFUSED → switches to gw2', async () => {
      const id = await freshWith([GW1, GW2])
      enroll
        .mockRejectedValueOnce(
          new GatewayError('unreachable', 'ECONNREFUSED', undefined, 'pre-send')
        )
        .mockResolvedValueOnce(undefined)
      await loginPlugin(id)
      expect(enrollTargets()).toEqual([GW1, GW2])
      expect(vaults[id].gateway.lastGood).toBe(GW2)
      expect(pluginItems[id].status).toBe('active')
    })
    it('possibly-sent ECONNRESET → no switch', async () => {
      const id = await freshWith([GW1, GW2])
      enroll.mockRejectedValueOnce(
        new GatewayError('unreachable', 'ECONNRESET', undefined, 'possibly-sent')
      )
      await expect(loginPlugin(id)).rejects.toThrow('PLUGIN_LOGIN_NETWORK')
      expect(enrollTargets()).toEqual([GW1])
    })
  })

  describe('deferVaultCreate (§2.5)', () => {
    it('enroll ok, vault write fails → device revoked with the in-memory key', async () => {
      const item = await installPlugin(file())
      unwritableVaults.add(item.id)
      await expect(loginPlugin(item.id)).rejects.toThrow('PLUGIN_LOGIN_FAILED')
      expect(enroll).toHaveBeenCalledOnce()
      expect(revoke).toHaveBeenCalledOnce()
      expect(vaults[item.id]).toBeUndefined()
    })
    it('enroll ok, vault created, metadata patch fails → revoked and vault removed', async () => {
      const item = await installPlugin(file())
      const { patchPluginItem: patchMock } = await import('../../config/plugin')
      let armed = false
      vi.mocked(patchMock).mockImplementation(async (id: string, patch: Partial<IPluginItem>) => {
        if (armed && id === item.id) throw new Error('disk full')
        pluginItems[id] = { ...pluginItems[id], ...patch }
      })
      // 让 enroll 经过路由执行器，使 commit 有 lastGoodRoute 可写
      enroll.mockImplementationOnce(async (t: { gateway: string }, _b: unknown, requester) => {
        await (requester as { request: (u: string, o: unknown) => Promise<unknown> }).request(
          t.gateway + '/enroll',
          { method: 'POST', maxBytes: 1 }
        )
        armed = true
      })
      requestOnce.mockResolvedValueOnce({ status: 200, headers: {}, body: '{}' })
      await expect(loginPlugin(item.id)).rejects.toThrow('PLUGIN_LOGIN_FAILED')
      vi.mocked(patchMock).mockImplementation(async (id: string, patch: Partial<IPluginItem>) => {
        pluginItems[id] = { ...pluginItems[id], ...patch }
      })
      expect(revoke).toHaveBeenCalledOnce()
      expect(vaults[item.id]).toBeUndefined()
      expect(pluginItems[item.id].status).toBe('needs-login')
    })
  })
})

// §3 静态多信任根
describe('discoveryUrls (§3)', () => {
  it('previewPlugin exposes backup discovery hosts; installPlugin persists the origins', async () => {
    const f = file({ discoveryUrls: ['https://cdn.xx.com', 'https://gw.xx.com:8443'] })
    const p = await previewPlugin(f)
    expect(p.discoveryHosts).toEqual(['cdn.xx.com', 'gw.xx.com:8443'])
    const item = await installPlugin(f)
    expect(item.discoveryUrls).toEqual(['https://cdn.xx.com', 'https://gw.xx.com:8443'])
  })

  it('login discovery and recovery rediscovery pass [loginOrigin, ...discoveryUrls]', async () => {
    const item = await installPlugin(file({ discoveryUrls: ['https://cdn.xx.com'] }))
    await loginPlugin(item.id)
    expect(discoverGateway).toHaveBeenCalledWith(
      { sources: ['https://panel.xx.com', 'https://cdn.xx.com'] },
      expect.any(Object)
    )
    discoverGateway.mockClear()
    fetchConfig
      .mockRejectedValueOnce(new GatewayError('unreachable', 'x'))
      .mockResolvedValueOnce({ yaml: CLASH })
    discoverGateway.mockResolvedValueOnce({ ...WK, gateways: [GW2] })
    await updatePluginProfile(item.id, true)
    expect(discoverGateway).toHaveBeenCalledWith(
      { sources: ['https://panel.xx.com', 'https://cdn.xx.com'] },
      expect.any(Object)
    )
    expect(vaults[item.id].gateway.gateways).toEqual([GW2])
  })
})

// §4 机场消息
describe('provider messages (§4)', () => {
  it('records lastProviderMessage and reason on failure, clears both on the next success', async () => {
    const item = await installPlugin(file())
    await loginPlugin(item.id)
    const err = new GatewayError('transient', '503', 503)
    err.providerMessage = '维护中，请稍后再试'
    fetchConfig.mockRejectedValueOnce(err)
    await updatePluginProfile(item.id, true)
    expect(pluginItems[item.id].lastProviderMessage).toBe('维护中，请稍后再试')
    expect(pluginItems[item.id].lastUpdateErrorReason).toBe('server')
    fetchConfig.mockResolvedValueOnce({ yaml: CLASH })
    await updatePluginProfile(item.id, true)
    expect(pluginItems[item.id].lastProviderMessage).toBeUndefined()
    expect(pluginItems[item.id].lastUpdateErrorReason).toBeUndefined()
  })

  it('login failure records the message but still throws the sanitized constant', async () => {
    const item = await installPlugin(file())
    const err = new GatewayError('revoked', 'revoked', 403)
    err.providerMessage = '账号已停用'
    enroll.mockRejectedValueOnce(err)
    await expect(loginPlugin(item.id)).rejects.toThrow('PLUGIN_LOGIN_REVOKED')
    expect(pluginItems[item.id].lastProviderMessage).toBe('账号已停用')
    expect(pluginItems[item.id].status).toBe('needs-login')
  })

  it('blocked → reason=blocked and no provider message', async () => {
    const item = await installPlugin(file())
    await loginPlugin(item.id)
    fetchConfig.mockRejectedValueOnce(new GatewayError('blocked', 'refused'))
    await updatePluginProfile(item.id, true)
    expect(pluginItems[item.id].lastUpdateErrorReason).toBe('blocked')
    expect(pluginItems[item.id].lastProviderMessage).toBeUndefined()
  })

  it('provider.description flows into preview and the installed record', async () => {
    const f = file({ provider: { name: 'XX', description: '第一行\n第二行' } })
    expect((await previewPlugin(f)).description).toBe('第一行\n第二行')
    expect((await installPlugin(f)).description).toBe('第一行\n第二行')
  })
})

// §5a 签名发现文档：X-CPX-Discovery 消费与提交合并
describe('signed discovery via X-CPX-Discovery (§5a)', () => {
  interface Vector {
    seedB64: string
    pubKeyB64: string
    payloadJson: string
  }
  const vectors: Vector[] = JSON.parse(
    readFileSync(join(__dirname, '__fixtures__', 'discovery-vectors.json'), 'utf-8')
  )
  const V = vectors[0]
  const PKCS8 = Buffer.from('302e020100300506032b657004220420', 'hex')
  function envelope(payload: Record<string, unknown>): { signed: string; digest: string } {
    const bytes = Buffer.from(JSON.stringify(payload), 'utf-8')
    const key = createPrivateKey({
      key: Buffer.concat([PKCS8, Buffer.from(V.seedB64, 'base64')]),
      format: 'der',
      type: 'pkcs8'
    })
    return {
      signed: `${bytes.toString('base64')}.${sign(null, buildDiscoverySignInput(bytes), key).toString('base64')}`,
      digest: sha256Hex(bytes)
    }
  }
  const payload = (seq: number, gateways: string[]): Record<string, unknown> => ({
    spec: 'cpx-plugin/2',
    seq,
    gateways,
    endpoints: WK.endpoints
  })
  async function keyedActive(seq = 12): Promise<string> {
    const item = await installPlugin(file({ providerPubKey: V.pubKeyB64 }))
    const { digest } = envelope(payload(seq, [GW1]))
    // 登录用的发现文档带 seq
    discoverGateway.mockResolvedValue({ ...WK, gateways: [GW1], seq, digest })
    await loginPlugin(item.id)
    expect(pluginItems[item.id].discoverySeq).toBe(seq)
    expect(pluginItems[item.id].discoveryDigest).toBe(digest)
    vaults[item.id] = { ...vaults[item.id], gateway: state([GW1, GW2], GW2) }
    return item.id
  }
  const fetchWithHeader = (signed: string | string[]): void => {
    fetchConfig.mockResolvedValueOnce({ yaml: CLASH, discovery: signed as string })
  }

  it('login persists seq/digest from the signed discovery document', async () => {
    await keyedActive(12)
  })

  it('header seq 13 > 12 → vault list replaced, lastGood cleared, plugin.yaml seq/digest advanced', async () => {
    const id = await keyedActive(12)
    const { signed, digest } = envelope(payload(13, [GW3, GW2]))
    fetchWithHeader(signed)
    await updatePluginProfile(id, true)
    expect(vaults[id].gateway.gateways).toEqual([GW3, GW2])
    expect(vaults[id].gateway.lastGood).toBeUndefined()
    expect(vaults[id].gateway.gateway).toBe(GW3)
    expect(pluginItems[id].discoverySeq).toBe(13)
    expect(pluginItems[id].discoveryDigest).toBe(digest)
    expect(pluginItems[id].status).toBe('active')
  })

  it('header seq 11 < 12 → ignored, vault and plugin.yaml unchanged', async () => {
    const id = await keyedActive(12)
    const before = pluginItems[id].discoveryDigest
    fetchWithHeader(envelope(payload(11, [GW3])).signed)
    await updatePluginProfile(id, true)
    expect(vaults[id].gateway.gateways).toEqual([GW1, GW2])
    expect(vaults[id].gateway.lastGood).toBe(GW2)
    expect(pluginItems[id].discoverySeq).toBe(12)
    expect(pluginItems[id].discoveryDigest).toBe(before)
  })

  it('header seq 12 with a different digest → rejected (equivocation)', async () => {
    const id = await keyedActive(12)
    fetchWithHeader(envelope(payload(12, [GW3])).signed)
    await updatePluginProfile(id, true)
    expect(vaults[id].gateway.gateways).toEqual([GW1, GW2])
    expect(pluginItems[id].discoverySeq).toBe(12)
  })

  it('header seq 12 with the same digest aligns idempotently and keeps lastGood', async () => {
    const id = await keyedActive(12)
    fetchWithHeader(envelope(payload(12, [GW1])).signed)
    await updatePluginProfile(id, true)
    // 对齐：列表按签名文档重放为 [GW1]；lastGood=GW2 不在其中 → 清空
    expect(vaults[id].gateway.gateways).toEqual([GW1])
    expect(pluginItems[id].discoverySeq).toBe(12)
  })

  it('R2-ISS-005: a higher seq with an identical list still clears lastGood; only same-seq alignment keeps it', async () => {
    const id = await keyedActive(12)
    // vault [GW1, GW2] with lastGood=GW2; a NEW document (seq 13) with the same list → lastGood cleared
    fetchWithHeader(envelope(payload(13, [GW1, GW2])).signed)
    await updatePluginProfile(id, true)
    expect(vaults[id].gateway.gateways).toEqual([GW1, GW2])
    expect(vaults[id].gateway.lastGood).toBeUndefined()
    expect(vaults[id].gateway.gateway).toBe(GW1)
    expect(pluginItems[id].discoverySeq).toBe(13)
    // the SAME document (seq 13, same digest) replayed after a success on GW2 → alignment keeps lastGood
    vaults[id] = { ...vaults[id], gateway: state([GW1, GW2], GW2) }
    fetchWithHeader(envelope(payload(13, [GW1, GW2])).signed)
    await updatePluginProfile(id, true)
    expect(vaults[id].gateway.lastGood).toBe(GW2)
    expect(pluginItems[id].discoverySeq).toBe(13)
  })

  it.each([
    ['bad signature', 'AAAA.BBBB'],
    ['array header', ['a.b', 'c.d']],
    ['unknown key', 'unknown']
  ] as const)(
    '%s header → ignored with a warning; config still saved, status active',
    async (_n, hdr) => {
      const id = await keyedActive(12)
      const signed =
        hdr === 'unknown'
          ? envelope({ ...payload(13, [GW3]), extra: true }).signed
          : (hdr as string | string[])
      fetchWithHeader(signed)
      await updatePluginProfile(id, true)
      expect(pluginItems[id].status).toBe('active')
      expect(vaults[id].gateway.gateways).toEqual([GW1, GW2])
      expect(pluginItems[id].discoverySeq).toBe(12)
    }
  )

  it('an unkeyed plugin ignores the header completely', async () => {
    const item = await installPlugin(file())
    await loginPlugin(item.id)
    fetchWithHeader(envelope(payload(13, [GW3])).signed)
    await updatePluginProfile(item.id, true)
    expect(vaults[item.id].gateway.gateways).toEqual([GW1])
    expect(pluginItems[item.id].discoverySeq).toBeUndefined()
  })

  it('recovery lastGood=gw2 and a higher-seq header candidate in the same op → candidate replaces the list, lastGood cleared', async () => {
    const id = await keyedActive(12)
    vaults[id] = { ...vaults[id], gateway: state([GW1, GW2]) }
    const { signed } = envelope(payload(13, [GW3]))
    fetchConfig
      .mockRejectedValueOnce(new GatewayError('unreachable', 'x'))
      .mockResolvedValueOnce({ yaml: CLASH, discovery: signed })
    await updatePluginProfile(id, true)
    expect(vaults[id].gateway.gateways).toEqual([GW3])
    expect(vaults[id].gateway.lastGood).toBeUndefined()
    expect(pluginItems[id].discoverySeq).toBe(13)
  })

  it('keyed plugin: rediscovery passes the signer and persists the new seq', async () => {
    const id = await keyedActive(12)
    const { digest } = envelope(payload(13, [GW3]))
    fetchConfig
      .mockRejectedValueOnce(new GatewayError('unreachable', 'x'))
      .mockRejectedValueOnce(new GatewayError('unreachable', 'x'))
      .mockResolvedValueOnce({ yaml: CLASH })
    discoverGateway.mockResolvedValueOnce({ ...WK, gateways: [GW3], seq: 13, digest })
    await updatePluginProfile(id, true)
    expect(discoverGateway).toHaveBeenLastCalledWith(
      expect.objectContaining({
        signer: { pubKeyB64: V.pubKeyB64, minSeq: 12, currentDigest: expect.any(String) }
      }),
      expect.any(Object)
    )
    expect(pluginItems[id].discoverySeq).toBe(13)
    expect(vaults[id].gateway.gateways).toEqual([GW3])
  })
})

// §5b 公开字段轮换与首次登录顺序
describe('signed discovery: public field rotation (§5b)', () => {
  interface Vector {
    seedB64: string
    pubKeyB64: string
  }
  const V: Vector = JSON.parse(
    readFileSync(join(__dirname, '__fixtures__', 'discovery-vectors.json'), 'utf-8')
  )[0]
  const PKCS8 = Buffer.from('302e020100300506032b657004220420', 'hex')
  function envelope(payload: Record<string, unknown>): { signed: string; digest: string } {
    const bytes = Buffer.from(JSON.stringify(payload), 'utf-8')
    const key = createPrivateKey({
      key: Buffer.concat([PKCS8, Buffer.from(V.seedB64, 'base64')]),
      format: 'der',
      type: 'pkcs8'
    })
    return {
      signed: `${bytes.toString('base64')}.${sign(null, buildDiscoverySignInput(bytes), key).toString('base64')}`,
      digest: sha256Hex(bytes)
    }
  }
  const payload = (seq: number, extra: Record<string, unknown> = {}): Record<string, unknown> => ({
    spec: 'cpx-plugin/2',
    seq,
    gateways: [GW1],
    endpoints: WK.endpoints,
    ...extra
  })
  const NEW_LOGIN = 'https://panel-new.xx.com/oauth/authorize'

  it('first login: a rotated loginUrl is persisted with seq/digest before the browser opens and the browser gets the new URL', async () => {
    const item = await installPlugin(file({ providerPubKey: V.pubKeyB64 }))
    const { digest } = envelope(
      payload(13, { loginUrl: NEW_LOGIN, discoveryUrls: ['https://cdn.xx.com'] })
    )
    discoverGateway.mockResolvedValueOnce({
      ...WK,
      seq: 13,
      digest,
      loginUrl: NEW_LOGIN,
      discoveryUrls: ['https://cdn.xx.com']
    })
    let seenAtBrowser: Partial<IPluginItem> = {}
    let urlAtBrowser = ''
    browserLogin.mockImplementationOnce(async (url: string) => {
      seenAtBrowser = { ...pluginItems[item.id] }
      urlAtBrowser = url
      return { code: 'C', verifier: 'V', redirectUri: 'http://127.0.0.1:1/callback' }
    })
    await loginPlugin(item.id)
    expect(urlAtBrowser).toBe(NEW_LOGIN)
    expect(seenAtBrowser.discoverySeq).toBe(13)
    expect(seenAtBrowser.discoveryDigest).toBe(digest)
    expect(seenAtBrowser.loginUrl).toBe(NEW_LOGIN)
    expect(seenAtBrowser.discoveryUrls).toEqual(['https://cdn.xx.com'])
    expect(pluginItems[item.id].status).toBe('active')
    expect(pluginItems[item.id].loginUrl).toBe(NEW_LOGIN)
    expect(pluginItems[item.id].discoveryUrls).toEqual(['https://cdn.xx.com'])
  })

  it('browser cancelled after a rotation → seq stays; the next discovery is signed with minSeq 13', async () => {
    const item = await installPlugin(file({ providerPubKey: V.pubKeyB64 }))
    const { digest } = envelope(payload(13, { loginUrl: NEW_LOGIN }))
    discoverGateway.mockResolvedValueOnce({ ...WK, seq: 13, digest, loginUrl: NEW_LOGIN })
    browserLogin.mockRejectedValueOnce(new Error('Login timed out'))
    await expect(loginPlugin(item.id)).rejects.toThrow('PLUGIN_LOGIN_FAILED')
    expect(pluginItems[item.id].discoverySeq).toBe(13)
    expect(pluginItems[item.id].loginUrl).toBe(NEW_LOGIN)
    discoverGateway.mockClear()
    discoverGateway.mockResolvedValueOnce({ ...WK, seq: 13, digest })
    await loginPlugin(item.id)
    expect(discoverGateway).toHaveBeenCalledWith(
      expect.objectContaining({
        signer: { pubKeyB64: V.pubKeyB64, minSeq: 13, currentDigest: digest }
      }),
      expect.any(Object)
    )
  })

  it('header rotates loginUrl and discoveryUrls; [] clears; missing leaves them unchanged', async () => {
    const item = await installPlugin(
      file({ providerPubKey: V.pubKeyB64, discoveryUrls: ['https://old.xx.com'] })
    )
    const first = envelope(payload(12))
    discoverGateway.mockResolvedValue({ ...WK, seq: 12, digest: first.digest })
    await loginPlugin(item.id)
    expect(pluginItems[item.id].discoveryUrls).toEqual(['https://old.xx.com'])

    fetchConfig.mockResolvedValueOnce({
      yaml: CLASH,
      discovery: envelope(
        payload(13, { loginUrl: NEW_LOGIN, discoveryUrls: ['https://cdn.xx.com'] })
      ).signed
    })
    await updatePluginProfile(item.id, true)
    expect(pluginItems[item.id].loginUrl).toBe(NEW_LOGIN)
    expect(pluginItems[item.id].discoveryUrls).toEqual(['https://cdn.xx.com'])
    expect(pluginItems[item.id].discoverySeq).toBe(13)

    // no loginUrl in the payload: an entry equal to the CURRENT login origin is dropped at apply time
    fetchConfig.mockResolvedValueOnce({
      yaml: CLASH,
      discovery: envelope(
        payload(14, { discoveryUrls: ['https://cdn.xx.com', 'https://panel-new.xx.com'] })
      ).signed
    })
    await updatePluginProfile(item.id, true)
    expect(pluginItems[item.id].loginUrl).toBe(NEW_LOGIN)
    expect(pluginItems[item.id].discoveryUrls).toEqual(['https://cdn.xx.com'])

    // neither field present → unchanged
    fetchConfig.mockResolvedValueOnce({ yaml: CLASH, discovery: envelope(payload(15)).signed })
    await updatePluginProfile(item.id, true)
    expect(pluginItems[item.id].loginUrl).toBe(NEW_LOGIN)
    expect(pluginItems[item.id].discoveryUrls).toEqual(['https://cdn.xx.com'])

    // [] clears
    fetchConfig.mockResolvedValueOnce({
      yaml: CLASH,
      discovery: envelope(payload(16, { discoveryUrls: [] })).signed
    })
    await updatePluginProfile(item.id, true)
    expect(pluginItems[item.id].discoveryUrls).toBeUndefined()
    expect(pluginItems[item.id].discoverySeq).toBe(16)
  })

  it('failure between the vault write and the plugin.yaml write is repaired by the next same-seq arrival', async () => {
    const item = await installPlugin(file({ providerPubKey: V.pubKeyB64 }))
    const first = envelope(payload(12))
    discoverGateway.mockResolvedValue({ ...WK, seq: 12, digest: first.digest })
    await loginPlugin(item.id)
    const next = envelope(payload(13, { gateways: [GW2] }))
    const { patchPluginItem: patchMock } = await import('../../config/plugin')
    let failOnce = true
    vi.mocked(patchMock).mockImplementation(async (id: string, patch: Partial<IPluginItem>) => {
      if (failOnce && id === item.id && patch.discoverySeq === 13) {
        failOnce = false
        throw new Error('disk full')
      }
      pluginItems[id] = { ...pluginItems[id], ...patch }
    })
    fetchConfig.mockResolvedValueOnce({ yaml: CLASH, discovery: next.signed })
    await expect(updatePluginProfile(item.id, true)).rejects.toThrow('disk full')
    // vault advanced, marker did not
    expect(vaults[item.id].gateway.gateways).toEqual([GW2])
    expect(pluginItems[item.id].discoverySeq).toBe(12)
    fetchConfig.mockResolvedValueOnce({ yaml: CLASH, discovery: next.signed })
    await updatePluginProfile(item.id, true)
    expect(pluginItems[item.id].discoverySeq).toBe(13)
    expect(pluginItems[item.id].discoveryDigest).toBe(next.digest)
    expect(vaults[item.id].gateway.gateways).toEqual([GW2])
    vi.mocked(patchMock).mockImplementation(async (id: string, patch: Partial<IPluginItem>) => {
      pluginItems[id] = { ...pluginItems[id], ...patch }
    })
  })
})

// codex-review round 2 (cpx-v2-hardening-20260907) — login flow / deletion critical section
describe('R2 login flow and deletion fixes', () => {
  interface Vector {
    seedB64: string
    pubKeyB64: string
  }
  const V: Vector = JSON.parse(
    readFileSync(join(__dirname, '__fixtures__', 'discovery-vectors.json'), 'utf-8')
  )[0]
  const PKCS8 = Buffer.from('302e020100300506032b657004220420', 'hex')
  function envelope(payload: Record<string, unknown>): { signed: string; digest: string } {
    const bytes = Buffer.from(JSON.stringify(payload), 'utf-8')
    const key = createPrivateKey({
      key: Buffer.concat([PKCS8, Buffer.from(V.seedB64, 'base64')]),
      format: 'der',
      type: 'pkcs8'
    })
    return {
      signed: `${bytes.toString('base64')}.${sign(null, buildDiscoverySignInput(bytes), key).toString('base64')}`,
      digest: sha256Hex(bytes)
    }
  }
  const payload = (seq: number, gateways: string[]): Record<string, unknown> => ({
    spec: 'cpx-plugin/2',
    seq,
    gateways,
    endpoints: WK.endpoints
  })
  function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void } {
    let resolve!: (v: T) => void
    const promise = new Promise<T>((r) => {
      resolve = r
    })
    return { promise, resolve }
  }
  // keyed plugin logged in at seq 12 / [GW1]
  async function keyedLoggedIn(): Promise<string> {
    const item = await installPlugin(file({ providerPubKey: V.pubKeyB64 }))
    const { digest } = envelope(payload(12, [GW1]))
    discoverGateway.mockResolvedValue({ ...WK, gateways: [GW1], seq: 12, digest })
    await loginPlugin(item.id)
    expect(pluginItems[item.id].discoverySeq).toBe(12)
    return item.id
  }

  it('R2-ISS-003: re-login with an existing vault syncs the vault before the browser opens; a cancelled browser leaves vault and seq consistent', async () => {
    const id = await keyedLoggedIn()
    pluginItems[id] = { ...pluginItems[id], status: 'needs-reauth' }
    const next = envelope(payload(13, [GW2]))
    discoverGateway.mockResolvedValueOnce({ ...WK, gateways: [GW2], seq: 13, digest: next.digest })
    let vaultAtBrowser: string[] = []
    browserLogin.mockImplementationOnce(async () => {
      vaultAtBrowser = [...vaults[id].gateway.gateways]
      throw new Error('Login timed out')
    })
    await expect(loginPlugin(id)).rejects.toThrow('PLUGIN_LOGIN_FAILED')
    expect(vaultAtBrowser).toEqual([GW2])
    expect(vaults[id].gateway.gateways).toEqual([GW2])
    expect(pluginItems[id].discoverySeq).toBe(13)
    expect(pluginItems[id].discoveryDigest).toBe(next.digest)
  })

  it('R2-ISS-020: an enroll that rediscovers and then fails still commits the rediscovered list into the existing vault', async () => {
    const id = await keyedLoggedIn()
    pluginItems[id] = { ...pluginItems[id], status: 'needs-reauth' }
    const { digest: d12 } = envelope(payload(12, [GW1]))
    const { digest: d13 } = envelope(payload(13, [GW3]))
    discoverGateway
      .mockResolvedValueOnce({ ...WK, gateways: [GW1], seq: 12, digest: d12 }) // login discovery
      .mockResolvedValueOnce({ ...WK, gateways: [GW3], seq: 13, digest: d13 }) // rediscovery in enroll
    enroll
      .mockRejectedValueOnce(new GatewayError('unreachable', 'refused', undefined, 'pre-send'))
      .mockRejectedValueOnce(new GatewayError('transient', '503', 503))
    await expect(loginPlugin(id)).rejects.toThrow('PLUGIN_LOGIN_NETWORK')
    expect(vaults[id].gateway.gateways).toEqual([GW3])
    expect(pluginItems[id].discoverySeq).toBe(13)
    expect(pluginItems[id].status).toBe('needs-reauth')
  })

  it('R2-ISS-008: a header accepted during the browser wait redirects the enroll and the new vault', async () => {
    const id = await keyedLoggedIn()
    const oldDevice = vaults[id].deviceId
    const browser = deferred<{ code: string; verifier: string; redirectUri: string }>()
    browserLogin.mockReturnValueOnce(browser.promise)
    const login = loginPlugin(id)
    await new Promise((r) => setTimeout(r, 5))
    // meanwhile a scheduled update (old device, still valid) accepts seq 13 / [GW2]
    fetchConfig.mockResolvedValueOnce({
      yaml: CLASH,
      discovery: envelope(payload(13, [GW2])).signed
    })
    await updatePluginProfile(id, true)
    expect(vaults[id].gateway.gateways).toEqual([GW2])
    browser.resolve({ code: 'C', verifier: 'V', redirectUri: 'http://127.0.0.1:1/callback' })
    await login
    const enrollTarget = enroll.mock.calls[enroll.mock.calls.length - 1][0] as { gateway: string }
    expect(enrollTarget.gateway).toBe(GW2)
    expect(vaults[id].deviceId).not.toBe(oldDevice)
    expect(vaults[id].gateway.gateways).toEqual([GW2])
    expect(pluginItems[id].discoverySeq).toBe(13)
  })

  it('R2-ISS-001: an update queued while enroll is in flight runs after the new vault exists and cannot be rolled back', async () => {
    const id = await keyedLoggedIn()
    const slowEnroll = deferred<void>()
    enroll.mockReturnValueOnce(slowEnroll.promise)
    const login = loginPlugin(id)
    await new Promise((r) => setTimeout(r, 5))
    fetchConfig.mockResolvedValueOnce({
      yaml: CLASH,
      discovery: envelope(payload(14, [GW3])).signed
    })
    const update = updatePluginProfile(id, true)
    await new Promise((r) => setTimeout(r, 5))
    expect(fetchConfig).toHaveBeenCalledTimes(1) // the update is still queued behind the enroll op
    slowEnroll.resolve()
    await Promise.all([login, update])
    expect(pluginItems[id].discoverySeq).toBe(14)
    expect(vaults[id].gateway.gateways).toEqual([GW3])
    expect(pluginItems[id].status).toBe('active')
  })

  it('R2-ISS-021: a re-login whose vault write fails keeps the still-valid old vault and revokes only the new device', async () => {
    const id = await keyedLoggedIn()
    const oldDevice = vaults[id].deviceId
    pluginItems[id] = { ...pluginItems[id], status: 'needs-reauth' }
    unwritableVaults.add(id)
    await expect(loginPlugin(id)).rejects.toThrow('PLUGIN_LOGIN_FAILED')
    expect(vaults[id].deviceId).toBe(oldDevice)
    expect(revoke).toHaveBeenCalledOnce()
    expect((revoke.mock.calls[0][1] as { deviceId: string }).deviceId).not.toBe(oldDevice)
  })

  it('R2-ISS-036: needs-reauth re-login that enrolls but fails its first fetch reuses the new device next time', async () => {
    const id = await keyedLoggedIn()
    const oldDevice = vaults[id].deviceId
    pluginItems[id] = { ...pluginItems[id], status: 'needs-reauth' }
    fetchConfig.mockRejectedValueOnce(new GatewayError('transient', '503', 503))
    await expect(loginPlugin(id)).rejects.toThrow('PLUGIN_LOGIN_NETWORK')
    expect(pluginItems[id].status).toBe('needs-login')
    const newDevice = vaults[id].deviceId
    expect(newDevice).not.toBe(oldDevice)
    const browserCalls = browserLogin.mock.calls.length
    const enrollCalls = enroll.mock.calls.length
    await loginPlugin(id)
    expect(browserLogin.mock.calls.length).toBe(browserCalls) // orphan-device branch: no browser
    expect(enroll.mock.calls.length).toBe(enrollCalls) // and no new device
    expect(vaults[id].deviceId).toBe(newDevice)
    expect(pluginItems[id].status).toBe('active')
  })

  it('R2-ISS-037: a possibly-sent enroll failure best-effort revokes the in-memory device; a pre-send failure does not', async () => {
    const a = await installPlugin(file())
    enroll.mockRejectedValueOnce(
      new GatewayError('unreachable', 'reset', undefined, 'possibly-sent')
    )
    await expect(loginPlugin(a.id)).rejects.toThrow('PLUGIN_LOGIN_NETWORK')
    expect(revoke).toHaveBeenCalledOnce()
    const enrolledDevice = (enroll.mock.calls[0][1] as { deviceId: string }).deviceId
    expect((revoke.mock.calls[0][1] as { deviceId: string }).deviceId).toBe(enrolledDevice)
    expect(vaults[a.id]).toBeUndefined()

    revoke.mockClear()
    const b = await installPlugin(file())
    enroll.mockRejectedValueOnce(new GatewayError('unreachable', 'refused', undefined, 'pre-send'))
    await expect(loginPlugin(b.id)).rejects.toThrow('PLUGIN_LOGIN_NETWORK')
    expect(revoke).not.toHaveBeenCalled()
  })

  it('R2-ISS-037b: the uncertain-enroll compensation also runs when the metadata patch throws or the commit was skipped by a tombstone', async () => {
    // (1) possibly-sent failure carrying a provider message (so the failure patch is non-empty) + the patch throws
    //     → the compensation still revokes the device
    const a = await installPlugin(file())
    const { patchPluginItem: patchMock } = await import('../../config/plugin')
    const uncertain = new GatewayError('unreachable', 'reset', undefined, 'possibly-sent')
    uncertain.providerMessage = '维护中'
    enroll.mockRejectedValueOnce(uncertain)
    let armed = false
    browserLogin.mockImplementationOnce(async () => {
      armed = true
      return { code: 'C', verifier: 'V', redirectUri: 'http://127.0.0.1:1/callback' }
    })
    vi.mocked(patchMock).mockImplementation(async (id: string, patch: Partial<IPluginItem>) => {
      if (armed && id === a.id) throw new Error('disk full')
      pluginItems[id] = { ...pluginItems[id], ...patch }
    })
    await expect(loginPlugin(a.id)).rejects.toThrow('PLUGIN_LOGIN_FAILED')
    vi.mocked(patchMock).mockImplementation(async (id: string, patch: Partial<IPluginItem>) => {
      pluginItems[id] = { ...pluginItems[id], ...patch }
    })
    expect(revoke).toHaveBeenCalledOnce()

    // (2) removal queued while a possibly-sent enroll failure is in flight → commit skipped by the tombstone,
    //     the compensation still revokes the device
    revoke.mockClear()
    const c = await installPlugin(file())
    let rejectEnroll!: (e: unknown) => void
    enroll.mockReturnValueOnce(new Promise<void>((_, rej) => (rejectEnroll = rej)))
    const login = loginPlugin(c.id)
    await new Promise((r) => setTimeout(r, 5))
    const removal = removePlugin(c.id)
    await new Promise((r) => setTimeout(r, 5))
    rejectEnroll(new GatewayError('unreachable', 'reset', undefined, 'possibly-sent'))
    await expect(login).rejects.toThrow('PLUGIN_LOGIN_NETWORK')
    await removal
    expect(revoke).toHaveBeenCalledOnce()
    expect(pluginItems[c.id]).toBeUndefined()
  })

  it('R2-ISS-038: a failed profile creation on first login does not produce a duplicate profile on retry', async () => {
    const item = await installPlugin(file())
    const { upsertPluginProfile: upsert } = await import('../../config/profile')
    vi.mocked(upsert).mockRejectedValueOnce(new Error('disk full'))
    await expect(loginPlugin(item.id)).rejects.toThrow('PLUGIN_LOGIN_FAILED')
    const reserved = pluginItems[item.id].profileId
    expect(reserved).toBeDefined()
    expect(Object.keys(profiles)).toHaveLength(0)
    await loginPlugin(item.id) // orphan-device branch → fetch → finishLogin
    expect(pluginItems[item.id].profileId).toBe(reserved)
    expect(Object.keys(profiles)).toEqual([reserved])
    expect(pluginItems[item.id].status).toBe('active')
  })

  it('R2-ISS-064: a re-login that replaces a still-valid device revokes the old one after the login completes', async () => {
    const id = await keyedLoggedIn()
    const oldDevice = vaults[id].deviceId
    revoke.mockClear()
    await loginPlugin(id) // active → fresh browser login + new device
    expect(vaults[id].deviceId).not.toBe(oldDevice)
    expect(revoke).toHaveBeenCalledOnce()
    expect((revoke.mock.calls[0][1] as { deviceId: string }).deviceId).toBe(oldDevice)
    expect(vaults[id].staleDevices).toBeUndefined()
  })

  it('R2-ISS-064: when the old device cannot be revoked it stays in the vault and is retried on the next successful fetch', async () => {
    const id = await keyedLoggedIn()
    const oldDevice = vaults[id].deviceId
    revoke.mockClear()
    revoke.mockRejectedValueOnce(new GatewayError('unreachable', 'gateway down'))
    await loginPlugin(id)
    expect(vaults[id].staleDevices?.map((d) => d.deviceId)).toEqual([oldDevice])
    expect(pluginItems[id].status).toBe('active') // the login itself is not affected
    revoke.mockClear()
    await updatePluginProfile(id, true)
    expect(revoke).toHaveBeenCalledOnce()
    expect((revoke.mock.calls[0][1] as { deviceId: string }).deviceId).toBe(oldDevice)
    expect(vaults[id].staleDevices).toBeUndefined()
  })

  it('R2-ISS-064: plugin removal revokes the stale devices as well as the current one', async () => {
    const id = await keyedLoggedIn()
    const current = vaults[id].deviceId
    vaults[id] = {
      ...vaults[id],
      staleDevices: [
        {
          deviceId: '33333333-3333-4333-8333-333333333333',
          devicePrivKey: vaults[id].devicePrivKey
        }
      ]
    }
    revoke.mockClear()
    await removePlugin(id)
    expect(revoke.mock.calls.map((c) => (c[1] as { deviceId: string }).deviceId)).toEqual([
      '33333333-3333-4333-8333-333333333333',
      current
    ])
  })

  it('R2-ISS-068: retiring several stale devices — the second one starts from the gateway state the first one committed', async () => {
    const id = await keyedLoggedIn() // seq 12 / GW1
    const key = vaults[id].devicePrivKey
    const X = '33333333-3333-4333-8333-333333333333'
    const Y = '44444444-4444-4444-8444-444444444444'
    vaults[id] = {
      ...vaults[id],
      staleDevices: [
        { deviceId: X, devicePrivKey: key },
        { deviceId: Y, devicePrivKey: key }
      ]
    }
    // X's revoke finds GW1 unreachable → rediscovery yields seq 13 / GW2 → X is revoked on GW2
    const next = envelope(payload(13, [GW2]))
    discoverGateway.mockResolvedValueOnce({ ...WK, gateways: [GW2], seq: 13, digest: next.digest })
    revoke.mockClear()
    revoke.mockRejectedValueOnce(new GatewayError('unreachable', 'refused', undefined, 'pre-send'))
    await updatePluginProfile(id, true)
    expect(vaults[id].staleDevices).toBeUndefined()
    // the committed state is the rediscovered one, and Y did not drag the pre-rediscovery gateway list back in
    expect(vaults[id].gateway.gateways).toEqual([GW2])
    expect(pluginItems[id].discoverySeq).toBe(13)
    expect(revoke.mock.calls.map((c) => (c[1] as { deviceId: string }).deviceId)).toEqual([X, X, Y])
  })

  it('R2-ISS-069: a stale device the server no longer knows is pruned instead of blocking the ones behind it', async () => {
    const id = await keyedLoggedIn()
    const key = vaults[id].devicePrivKey
    const X = '33333333-3333-4333-8333-333333333333'
    const Y = '44444444-4444-4444-8444-444444444444'
    vaults[id] = {
      ...vaults[id],
      staleDevices: [
        { deviceId: X, devicePrivKey: key },
        { deviceId: Y, devicePrivKey: key }
      ]
    }
    revoke.mockClear()
    revoke.mockRejectedValueOnce(new GatewayError('revoked', 'device_revoked'))
    await updatePluginProfile(id, true)
    expect(vaults[id].staleDevices).toBeUndefined()
    expect(revoke.mock.calls.map((c) => (c[1] as { deviceId: string }).deviceId)).toEqual([X, Y])
  })

  it('R2-ISS-070: a skipped tick (autoUpdate off / backoff) does not start a retirement', async () => {
    const id = await keyedLoggedIn()
    vaults[id] = {
      ...vaults[id],
      staleDevices: [
        {
          deviceId: '33333333-3333-4333-8333-333333333333',
          devicePrivKey: vaults[id].devicePrivKey
        }
      ]
    }
    pluginItems[id] = { ...pluginItems[id], autoUpdate: false }
    revoke.mockClear()
    fetchConfig.mockClear()
    await updatePluginProfile(id)
    expect(fetchConfig).not.toHaveBeenCalled()
    expect(revoke).not.toHaveBeenCalled()
    expect(vaults[id].staleDevices).toHaveLength(1)
  })

  it('R2-ISS-070 (V2): a fetch whose subscription fails core validation does not start a retirement', async () => {
    const id = await keyedLoggedIn()
    vaults[id] = {
      ...vaults[id],
      staleDevices: [
        {
          deviceId: '33333333-3333-4333-8333-333333333333',
          devicePrivKey: vaults[id].devicePrivKey
        }
      ]
    }
    const { upsertPluginProfile: upsert } = await import('../../config/profile')
    vi.mocked(upsert).mockRejectedValueOnce(
      Object.assign(new Error('bad config'), { code: 'PLUGIN_PROFILE_INVALID' })
    )
    revoke.mockClear()
    await updatePluginProfile(id, true)
    expect(pluginItems[id].lastUpdateErrorType).toBe('transient')
    expect(revoke).not.toHaveBeenCalled()
    expect(vaults[id].staleDevices).toHaveLength(1)
  })

  it('R2-ISS-041: a re-login whose metadata patch fails after the vault swap restores the old device vault', async () => {
    const id = await keyedLoggedIn() // seq 12 / device A
    const oldVault = vaults[id]
    const oldDevice = oldVault.deviceId
    // enroll rediscovers seq 13 so the success commit's metadata patch is non-empty (seq/digest)
    const next = envelope(payload(13, [GW2]))
    discoverGateway
      .mockResolvedValueOnce({
        ...WK,
        gateways: [GW1],
        seq: 12,
        digest: envelope(payload(12, [GW1])).digest
      })
      .mockResolvedValueOnce({ ...WK, gateways: [GW2], seq: 13, digest: next.digest })
    enroll
      .mockRejectedValueOnce(new GatewayError('unreachable', 'refused', undefined, 'pre-send'))
      .mockResolvedValueOnce(undefined) // second enroll (after rediscovery) succeeds → new device B written
    const { patchPluginItem: patchMock } = await import('../../config/plugin')
    vi.mocked(patchMock).mockImplementation(async (pid: string, patch: Partial<IPluginItem>) => {
      if (pid === id && patch.discoverySeq === 13) throw new Error('disk full')
      pluginItems[pid] = { ...pluginItems[pid], ...patch }
    })
    await expect(loginPlugin(id)).rejects.toThrow('PLUGIN_LOGIN_FAILED')
    vi.mocked(patchMock).mockImplementation(async (pid: string, patch: Partial<IPluginItem>) => {
      pluginItems[pid] = { ...pluginItems[pid], ...patch }
    })
    // the old device vault is restored (still usable / revocable); the new device was best-effort revoked
    expect(vaults[id].deviceId).toBe(oldDevice)
    expect(revoke).toHaveBeenCalledOnce()
    expect((revoke.mock.calls[0][1] as { deviceId: string }).deviceId).not.toBe(oldDevice)
  })

  it('R2-ISS-041 (follow-up): a new device whose compensation revoke fails is kept in the restored vault and retired by a later fetch', async () => {
    const id = await keyedLoggedIn() // seq 12 / device A
    const oldDevice = vaults[id].deviceId
    const next = envelope(payload(13, [GW2]))
    discoverGateway
      .mockResolvedValueOnce({
        ...WK,
        gateways: [GW1],
        seq: 12,
        digest: envelope(payload(12, [GW1])).digest
      })
      .mockResolvedValueOnce({ ...WK, gateways: [GW2], seq: 13, digest: next.digest })
    enroll
      .mockRejectedValueOnce(new GatewayError('unreachable', 'refused', undefined, 'pre-send'))
      .mockResolvedValueOnce(undefined)
    const { patchPluginItem: patchMock } = await import('../../config/plugin')
    vi.mocked(patchMock).mockImplementation(async (pid: string, patch: Partial<IPluginItem>) => {
      if (pid === id && patch.discoverySeq === 13) throw new Error('disk full')
      pluginItems[pid] = { ...pluginItems[pid], ...patch }
    })
    revoke.mockClear()
    // the compensation cannot reach any gateway (recovery retries included)
    revoke.mockRejectedValue(new GatewayError('unreachable', 'gateway down'))
    await expect(loginPlugin(id)).rejects.toThrow('PLUGIN_LOGIN_FAILED')
    vi.mocked(patchMock).mockImplementation(async (pid: string, patch: Partial<IPluginItem>) => {
      pluginItems[pid] = { ...pluginItems[pid], ...patch }
    })
    expect(revoke).toHaveBeenCalled()
    const newDevice = (revoke.mock.calls[0][1] as { deviceId: string }).deviceId
    revoke.mockReset().mockResolvedValue(undefined)
    expect(newDevice).not.toBe(oldDevice)
    // the old device vault is back, and it remembers the un-revoked new device
    expect(vaults[id].deviceId).toBe(oldDevice)
    expect(vaults[id].staleDevices?.map((d) => d.deviceId)).toEqual([newDevice])
    // a later successful fetch retires it
    revoke.mockClear()
    await updatePluginProfile(id, true)
    expect(revoke.mock.calls.map((c) => (c[1] as { deviceId: string }).deviceId)).toEqual([
      newDevice
    ])
    expect(vaults[id].staleDevices).toBeUndefined()
  })

  it('BL-002: a fetched subscription rejected by core validation keeps the old profile and backs off as server', async () => {
    const item = await installPlugin(file())
    await loginPlugin(item.id)
    const pid = pluginItems[item.id].profileId!
    const { upsertPluginProfile: upsert } = await import('../../config/profile')
    vi.mocked(upsert).mockRejectedValueOnce(
      Object.assign(new Error("proxy 'x' not found"), { code: 'PLUGIN_PROFILE_INVALID' })
    )
    fetchConfig.mockResolvedValueOnce({ yaml: 'proxies:\n  - {name: broken}\n' })
    await updatePluginProfile(item.id, true)
    expect(profiles[pid]).toBe(CLASH) // old subscription untouched
    expect(pluginItems[item.id].status).toBe('active')
    expect(pluginItems[item.id].lastUpdateErrorType).toBe('transient')
    expect(pluginItems[item.id].lastUpdateErrorReason).toBe('server')
    expect(pluginItems[item.id].nextRetryAt).toBeDefined()
    // a later good fetch clears the failure state
    await updatePluginProfile(item.id, true)
    expect(pluginItems[item.id].lastUpdateErrorReason).toBeUndefined()
  })

  it('BL-002: a first login whose subscription fails validation ends as NETWORK and the next login reuses the device', async () => {
    const item = await installPlugin(file())
    const { upsertPluginProfile: upsert } = await import('../../config/profile')
    vi.mocked(upsert).mockRejectedValueOnce(
      Object.assign(new Error('bad config'), { code: 'PLUGIN_PROFILE_INVALID' })
    )
    await expect(loginPlugin(item.id)).rejects.toThrow('PLUGIN_LOGIN_NETWORK')
    expect(pluginItems[item.id].status).toBe('needs-login')
    expect(pluginItems[item.id].lastUpdateErrorReason).toBe('server')
    expect(vaults[item.id]).toBeDefined()
    expect(Object.keys(profiles)).toHaveLength(0)
    const enrollCalls = enroll.mock.calls.length
    await loginPlugin(item.id) // orphan-device branch: same device, valid config now
    expect(enroll.mock.calls.length).toBe(enrollCalls)
    expect(pluginItems[item.id].status).toBe('active')
    expect(Object.keys(profiles)).toHaveLength(1)
  })

  it('BL-003: changing autoUpdate / interval through the IPC patch syncs the profile schedule', async () => {
    const item = await installPlugin(file())
    await loginPlugin(item.id)
    const pid = pluginItems[item.id].profileId!
    const { syncPluginProfileSchedule: sync } = await import('../../config/profile')
    vi.mocked(sync).mockClear()
    await patchPluginItem(item.id, { autoUpdate: false })
    expect(sync).toHaveBeenCalledWith(pid, { autoUpdate: false })
    await patchPluginItem(item.id, { interval: 30 })
    expect(sync).toHaveBeenLastCalledWith(pid, { interval: 30 })
    await patchPluginItem(item.id, { routeMode: 'proxy' }) // unrelated field → no schedule sync
    expect(sync).toHaveBeenCalledTimes(2)
  })

  it('BL-003: a scheduled (non-forced) update is skipped once autoUpdate is off; a forced one still fetches', async () => {
    const item = await installPlugin(file())
    await loginPlugin(item.id)
    pluginItems[item.id] = { ...pluginItems[item.id], autoUpdate: false }
    fetchConfig.mockClear()
    await updatePluginProfile(item.id)
    expect(fetchConfig).not.toHaveBeenCalled()
    await updatePluginProfile(item.id, true)
    expect(fetchConfig).toHaveBeenCalledOnce()
  })

  it('BL-002 (V6): the commit signal is forwarded to the profile write on login and on update', async () => {
    const item = await installPlugin(file())
    const { upsertPluginProfile: upsert } = await import('../../config/profile')
    vi.mocked(upsert).mockClear()
    await loginPlugin(item.id)
    expect(vi.mocked(upsert).mock.calls[0][2]).toBeInstanceOf(AbortSignal)
    await updatePluginProfile(item.id, true)
    expect(vi.mocked(upsert).mock.calls[1][2]).toBeInstanceOf(AbortSignal)
  })

  it('R2-ISS-052: the profile write carries no schedule snapshot — the schedule is read at write time', async () => {
    const item = await installPlugin(file())
    const { upsertPluginProfile: upsert } = await import('../../config/profile')
    vi.mocked(upsert).mockClear()
    await loginPlugin(item.id)
    await updatePluginProfile(item.id, true)
    for (const call of vi.mocked(upsert).mock.calls) {
      expect(Object.keys(call[0]).sort()).toEqual(['name', 'pluginId', 'profileId'])
    }
  })

  it('R2-ISS-051: a validation rejected because the op budget ran out is recorded as network, not server', async () => {
    const item = await installPlugin(file())
    await loginPlugin(item.id)
    const { upsertPluginProfile: upsert } = await import('../../config/profile')
    vi.mocked(upsert).mockImplementationOnce(async (_m, _c, signal?: AbortSignal) => {
      // the core check outlived the budget: the signal fires, the profile write refuses to land
      await new Promise<void>((resolve) => signal!.addEventListener('abort', () => resolve()))
      throw Object.assign(new Error('aborted'), { code: 'PLUGIN_PROFILE_INVALID' })
    })
    vi.useFakeTimers()
    try {
      const p = updatePluginProfile(item.id, true)
      await vi.advanceTimersByTimeAsync(130_000)
      await p
    } finally {
      vi.useRealTimers()
    }
    expect(pluginItems[item.id].lastUpdateErrorType).toBe('transient')
    expect(pluginItems[item.id].lastUpdateErrorReason).toBe('network')
    expect(pluginItems[item.id].status).toBe('active')
  })

  it('R2-ISS-012: a profile deletion that throws (core restart) still removes the record and the vault', async () => {
    const item = await installPlugin(file())
    await loginPlugin(item.id)
    const { removePluginProfileContent: rm } = await import('../../config/profile')
    vi.mocked(rm).mockRejectedValueOnce(new Error('core restart failed'))
    await expect(removePlugin(item.id)).rejects.toThrow('core restart failed')
    expect(pluginItems[item.id]).toBeUndefined()
    expect(vaults[item.id]).toBeUndefined()
    expect(revoke).toHaveBeenCalledOnce()
  })
})

// codex-review cycle 1 — 修复回归测试
describe('codex-review fixes', () => {
  function deferred<T>(): {
    promise: Promise<T>
    resolve: (v: T) => void
    reject: (e: unknown) => void
  } {
    let resolve!: (v: T) => void
    let reject!: (e: unknown) => void
    const promise = new Promise<T>((r, j) => {
      resolve = r
      reject = j
    })
    return { promise, resolve, reject }
  }
  interface Vector {
    seedB64: string
    pubKeyB64: string
  }
  const V: Vector = JSON.parse(
    readFileSync(join(__dirname, '__fixtures__', 'discovery-vectors.json'), 'utf-8')
  )[0]
  const PKCS8 = Buffer.from('302e020100300506032b657004220420', 'hex')
  function envelope(payload: Record<string, unknown>): { signed: string; digest: string } {
    const bytes = Buffer.from(JSON.stringify(payload), 'utf-8')
    const key = createPrivateKey({
      key: Buffer.concat([PKCS8, Buffer.from(V.seedB64, 'base64')]),
      format: 'der',
      type: 'pkcs8'
    })
    return {
      signed: `${bytes.toString('base64')}.${sign(null, buildDiscoverySignInput(bytes), key).toString('base64')}`,
      digest: sha256Hex(bytes)
    }
  }
  const payload = (seq: number, extra: Record<string, unknown> = {}): Record<string, unknown> => ({
    spec: 'cpx-plugin/2',
    seq,
    gateways: [GW1],
    endpoints: WK.endpoints,
    ...extra
  })

  it('ISS-001: profiles-list cascade removes the profile even when an in-flight update re-created it', async () => {
    const item = await installPlugin(file())
    await loginPlugin(item.id)
    const pid = pluginItems[item.id].profileId!
    const slow = deferred<{ yaml: string }>()
    fetchConfig.mockReturnValueOnce(slow.promise)
    const update = updatePluginProfile(item.id, true)
    await new Promise((r) => setTimeout(r, 5))
    // 模拟 profile.ts 的级联入口：删除排在在途更新之后
    const removal = removePluginForProfile(item.id, pid)
    await new Promise((r) => setTimeout(r, 5))
    slow.resolve({ yaml: CLASH })
    await Promise.all([update, removal])
    expect(profiles[pid]).toBeUndefined()
    expect(pluginItems[item.id]).toBeUndefined()
    expect(vaults[item.id]).toBeUndefined()
  })

  it('ISS-006: removePlugin while /enroll is in flight still revokes the new device with the in-memory key', async () => {
    const item = await installPlugin(file())
    const slow = deferred<void>()
    enroll.mockReturnValueOnce(slow.promise)
    const login = loginPlugin(item.id)
    await new Promise((r) => setTimeout(r, 10)) // discovery + browser done, enroll in flight
    expect(enroll).toHaveBeenCalledTimes(1)
    const removal = removePlugin(item.id)
    await new Promise((r) => setTimeout(r, 5))
    slow.resolve()
    await expect(login).rejects.toThrow('PLUGIN_LOGIN_FAILED')
    await removal
    const [, cred] = revoke.mock.calls[revoke.mock.calls.length - 1]
    expect(revoke).toHaveBeenCalled()
    expect((cred as { deviceId: string }).deviceId).toBe(
      (enroll.mock.calls[0][1] as { deviceId: string }).deviceId
    )
    expect(pluginItems[item.id]).toBeUndefined()
    expect(vaults[item.id]).toBeUndefined()
  })

  it('ISS-023: removePlugin during the discovery op fails the login before the browser opens', async () => {
    const item = await installPlugin(file())
    const slow = deferred<typeof WK>()
    discoverGateway.mockReturnValueOnce(slow.promise)
    browserLogin.mockClear()
    const login = loginPlugin(item.id)
    await new Promise((r) => setTimeout(r, 5))
    const removal = removePlugin(item.id)
    await new Promise((r) => setTimeout(r, 5))
    slow.resolve(WK)
    await expect(login).rejects.toThrow('PLUGIN_LOGIN_FAILED')
    await removal
    expect(browserLogin).not.toHaveBeenCalled()
    expect(enroll).not.toHaveBeenCalled()
  })

  it('ISS-002: enroll receiving retired (410) does not switch gateways or replay the code', async () => {
    const item = await installPlugin(file())
    discoverGateway.mockResolvedValue({ ...WK, gateways: [GW1, GW2] })
    enroll.mockReset().mockRejectedValueOnce(new GatewayError('retired', 'gone', 410))
    await expect(loginPlugin(item.id)).rejects.toThrow('PLUGIN_LOGIN_NETWORK')
    expect(enroll).toHaveBeenCalledTimes(1)
    expect((enroll.mock.calls[0][0] as { gateway: string }).gateway).toBe(GW1)
  })

  it('ISS-004: enroll failure after a rediscovery still persists the rediscovered seq and loginUrl', async () => {
    const item = await installPlugin(file({ providerPubKey: V.pubKeyB64 }))
    const first = envelope(payload(12))
    const second = envelope(payload(13, { loginUrl: 'https://panel-new.xx.com/oauth/authorize' }))
    discoverGateway
      .mockResolvedValueOnce({ ...WK, seq: 12, digest: first.digest })
      .mockResolvedValueOnce({
        ...WK,
        gateways: [GW2],
        seq: 13,
        digest: second.digest,
        loginUrl: 'https://panel-new.xx.com/oauth/authorize'
      })
    enroll
      .mockRejectedValueOnce(new GatewayError('unreachable', 'ECONNREFUSED', undefined, 'pre-send'))
      .mockRejectedValueOnce(new GatewayError('transient', '503', 503))
    await expect(loginPlugin(item.id)).rejects.toThrow('PLUGIN_LOGIN_NETWORK')
    expect(pluginItems[item.id].discoverySeq).toBe(13)
    expect(pluginItems[item.id].discoveryDigest).toBe(second.digest)
    expect(pluginItems[item.id].loginUrl).toBe('https://panel-new.xx.com/oauth/authorize')
    expect(vaults[item.id]).toBeUndefined()
  })

  it('ISS-008: a skipped scheduled update keeps lastProviderMessage (needs-reauth and backoff)', async () => {
    const item = await installPlugin(file())
    await loginPlugin(item.id)
    const err = new GatewayError('revoked', 'revoked', 403)
    err.providerMessage = '账号已停用'
    fetchConfig.mockRejectedValueOnce(err)
    await updatePluginProfile(item.id, true)
    expect(pluginItems[item.id].status).toBe('needs-reauth')
    expect(pluginItems[item.id].lastProviderMessage).toBe('账号已停用')
    fetchConfig.mockClear()
    await updatePluginProfile(item.id) // scheduler tick
    expect(fetchConfig).not.toHaveBeenCalled()
    expect(pluginItems[item.id].lastProviderMessage).toBe('账号已停用')

    pluginItems[item.id] = {
      ...pluginItems[item.id],
      status: 'active',
      nextRetryAt: Date.now() + 60_000,
      lastProviderMessage: '维护中'
    }
    await updatePluginProfile(item.id)
    expect(pluginItems[item.id].lastProviderMessage).toBe('维护中')
  })

  it('ISS-009: signed mode — the same origin with a higher rediscovered seq is tried again', async () => {
    const item = await installPlugin(file({ providerPubKey: V.pubKeyB64 }))
    const first = envelope(payload(12))
    discoverGateway.mockResolvedValue({ ...WK, seq: 12, digest: first.digest })
    await loginPlugin(item.id)
    const next = envelope(payload(13))
    discoverGateway.mockClear().mockResolvedValueOnce({ ...WK, seq: 13, digest: next.digest })
    fetchConfig
      .mockRejectedValueOnce(new GatewayError('unreachable', 'x'))
      .mockResolvedValueOnce({ yaml: CLASH })
    await updatePluginProfile(item.id, true)
    expect(fetchConfig).toHaveBeenCalledTimes(3) // login + failed + retried after rediscovery
    expect(pluginItems[item.id].status).toBe('active')
    expect(pluginItems[item.id].discoverySeq).toBe(13)
  })

  it('ISS-012: a stale header after an accepted rediscovery is ignored; a newer one is applied', async () => {
    const item = await installPlugin(file({ providerPubKey: V.pubKeyB64 }))
    const first = envelope(payload(12))
    discoverGateway.mockResolvedValue({ ...WK, seq: 12, digest: first.digest })
    await loginPlugin(item.id)
    const redisc = envelope(payload(13, { gateways: [GW3] }))
    discoverGateway
      .mockClear()
      .mockResolvedValueOnce({ ...WK, gateways: [GW3], seq: 13, digest: redisc.digest })
    fetchConfig.mockRejectedValueOnce(new GatewayError('unreachable', 'x')).mockResolvedValueOnce({
      yaml: CLASH,
      discovery: envelope(payload(12, { gateways: [GW2] })).signed
    })
    await updatePluginProfile(item.id, true)
    expect(vaults[item.id].gateway.gateways).toEqual([GW3])
    expect(pluginItems[item.id].discoverySeq).toBe(13)

    discoverGateway.mockResolvedValueOnce({
      ...WK,
      gateways: [GW3],
      seq: 13,
      digest: redisc.digest
    })
    vaults[item.id] = { ...vaults[item.id], gateway: state([GW1]) }
    const newer = envelope(payload(14, { gateways: [GW2] }))
    fetchConfig
      .mockRejectedValueOnce(new GatewayError('unreachable', 'x'))
      .mockResolvedValueOnce({ yaml: CLASH, discovery: newer.signed })
    await updatePluginProfile(item.id, true)
    expect(vaults[item.id].gateway.gateways).toEqual([GW2])
    expect(pluginItems[item.id].discoverySeq).toBe(14)
  })

  it('ISS-012 (H2): a newer header applies its public fields relative to the rediscovered candidate', async () => {
    const item = await installPlugin(file({ providerPubKey: V.pubKeyB64 }))
    const first = envelope(payload(12))
    discoverGateway.mockResolvedValue({ ...WK, seq: 12, digest: first.digest })
    await loginPlugin(item.id)
    const original = pluginItems[item.id].loginUrl
    const redisc = envelope(
      payload(13, {
        loginUrl: 'https://panel-new.xx.com/oauth/authorize',
        discoveryUrls: ['https://cdn.xx.com']
      })
    )
    discoverGateway.mockClear().mockResolvedValueOnce({
      ...WK,
      seq: 13,
      digest: redisc.digest,
      loginUrl: 'https://panel-new.xx.com/oauth/authorize',
      discoveryUrls: ['https://cdn.xx.com']
    })
    // 更高 seq 的响应头把 loginUrl 恢复为原值并清空 discoveryUrls
    const newer = envelope(payload(14, { loginUrl: original, discoveryUrls: [] }))
    fetchConfig
      .mockRejectedValueOnce(new GatewayError('unreachable', 'x'))
      .mockResolvedValueOnce({ yaml: CLASH, discovery: newer.signed })
    await updatePluginProfile(item.id, true)
    expect(pluginItems[item.id].discoverySeq).toBe(14)
    expect(pluginItems[item.id].loginUrl).toBe(original)
    expect(pluginItems[item.id].discoveryUrls).toBeUndefined()
  })

  it('ISS-024: retired with a provider message followed by a failed rediscovery keeps the message and the network classification', async () => {
    const item = await installPlugin(file())
    await loginPlugin(item.id)
    const retired = new GatewayError('retired', 'gone', 410)
    retired.providerMessage = '服务地址已更换'
    fetchConfig.mockRejectedValueOnce(retired)
    discoverGateway
      .mockClear()
      .mockRejectedValueOnce(
        Object.assign(new Error('Discovery failed: status 404'), { status: 404 })
      )
    await updatePluginProfile(item.id, true)
    expect(pluginItems[item.id].status).toBe('active')
    expect(pluginItems[item.id].lastUpdateErrorReason).toBe('network')
    expect(pluginItems[item.id].lastProviderMessage).toBe('服务地址已更换')

    // 登录路径：同样脱敏为 NETWORK 而不是 FAILED
    pluginItems[item.id] = { ...pluginItems[item.id], status: 'needs-login' }
    fetchConfig.mockRejectedValueOnce(new GatewayError('unreachable', 'x'))
    discoverGateway.mockRejectedValueOnce(new Error('Invalid gateway discovery: not valid JSON'))
    await expect(loginPlugin(item.id)).rejects.toThrow('PLUGIN_LOGIN_NETWORK')
  })

  it('ISS-024 (multi-gateway): the retired message survives a later switchable error without one', async () => {
    const item = await installPlugin(file())
    await loginPlugin(item.id)
    vaults[item.id] = { ...vaults[item.id], gateway: state([GW1, GW2]) }
    const retired = new GatewayError('retired', 'gone', 410)
    retired.providerMessage = '服务地址已更换'
    fetchConfig
      .mockRejectedValueOnce(retired)
      .mockRejectedValueOnce(new GatewayError('unreachable', 'ENOTFOUND'))
    discoverGateway.mockClear().mockRejectedValueOnce(new Error('Discovery failed: status 404'))
    await updatePluginProfile(item.id, true)
    expect(fetchConfig).toHaveBeenCalledTimes(3)
    expect(pluginItems[item.id].lastProviderMessage).toBe('服务地址已更换')
    expect(pluginItems[item.id].lastUpdateErrorReason).toBe('network')
  })

  it('REG-2: a retired message is not carried into a blocked terminal', async () => {
    const item = await installPlugin(file())
    await loginPlugin(item.id)
    vaults[item.id] = { ...vaults[item.id], gateway: state([GW1, GW2]) }
    const retired = new GatewayError('retired', 'gone', 410)
    retired.providerMessage = '服务地址已更换'
    fetchConfig
      .mockRejectedValueOnce(retired)
      .mockRejectedValueOnce(new GatewayError('unreachable', 'ENOTFOUND'))
    discoverGateway.mockClear().mockRejectedValueOnce(
      Object.assign(new Error('Refusing to connect to non-public address: 10.0.0.1'), {
        code: 'CPX_GUARD_REFUSED',
        phase: 'pre-send'
      })
    )
    await updatePluginProfile(item.id, true)
    expect(pluginItems[item.id].lastUpdateErrorReason).toBe('blocked')
    expect(pluginItems[item.id].lastProviderMessage).toBeUndefined()
  })

  it('ISS-020: a discovery source refused by the guard is classified as blocked', async () => {
    const item = await installPlugin(file())
    await loginPlugin(item.id)
    fetchConfig.mockRejectedValueOnce(new GatewayError('unreachable', 'x'))
    discoverGateway.mockClear().mockRejectedValueOnce(
      Object.assign(new Error('Refusing to connect to non-public address: 10.0.0.1'), {
        code: 'CPX_GUARD_REFUSED',
        phase: 'pre-send'
      })
    )
    await updatePluginProfile(item.id, true)
    expect(pluginItems[item.id].lastUpdateErrorReason).toBe('blocked')
  })

  it('ISS-015/022: the IPC patch entry only accepts editable fields and a valid routeMode', async () => {
    const item = await installPlugin(file({ providerPubKey: V.pubKeyB64 }))
    await expect(patchPluginItem(item.id, { providerPubKey: undefined })).rejects.toThrow(
      /not editable/
    )
    await expect(
      patchPluginItem(item.id, { discoverySeq: 1 } as Partial<IPluginItem>)
    ).rejects.toThrow(/not editable/)
    await expect(
      patchPluginItem(item.id, { routeMode: 'true' as unknown as IPluginRouteMode })
    ).rejects.toThrow(/routeMode/)
    expect(pluginItems[item.id].providerPubKey).toBe(V.pubKeyB64)
    expect(pluginItems[item.id].routeMode).toBe('auto')
    await patchPluginItem(item.id, { routeMode: 'proxy', interval: 30, autoUpdate: false })
    expect(pluginItems[item.id]).toMatchObject({ routeMode: 'proxy', useProxy: true, interval: 30 })
  })
})
