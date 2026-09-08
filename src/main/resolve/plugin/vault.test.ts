import { mkdtempSync, rmSync, existsSync, writeFileSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  writeVault,
  readVault,
  updateVault,
  removeVault,
  removeVaultIfDevice,
  withVaultLock,
  parseVault,
  isVaultPersistent,
  VaultUnavailableError
} from './vault'

let TMP = ''
let encryptionAvailable = true
let asyncApiSupported = true
let decryptError: Error | undefined
let encryptError: Error | undefined
let shouldReEncrypt = false
let encryptionPrefix = 'enc:'
// Linux only: the password store Electron selected (basic_text = fixed-key fallback)
let linuxBackend = 'gnome_libsecret'
let encryptCalls = 0
let decryptCalls = 0
let syncEncryptCalls = 0
let syncDecryptCalls = 0
// when set, async decrypts wait on it (a decrypt that outlives the op budget)
let decryptGate: Promise<void> | undefined

vi.mock('electron', () => ({
  safeStorage: {
    get isAsyncEncryptionAvailable() {
      return asyncApiSupported ? async () => encryptionAvailable : undefined
    },
    get encryptStringAsync() {
      return asyncApiSupported
        ? async (value: string) => {
            encryptCalls++
            if (encryptError) throw encryptError
            return Buffer.from(encryptionPrefix + value, 'utf-8')
          }
        : undefined
    },
    get decryptStringAsync() {
      return asyncApiSupported
        ? async (encrypted: Buffer) => {
            decryptCalls++
            if (decryptGate) await decryptGate
            if (decryptError) throw decryptError
            const result = Buffer.from(encrypted)
              .toString('utf-8')
              .replace(/^(enc:|rot:)/, '')
            return { result, shouldReEncrypt }
          }
        : undefined
    },
    isEncryptionAvailable: () => encryptionAvailable,
    getSelectedStorageBackend: () => linuxBackend,
    encryptString: (value: string) => {
      syncEncryptCalls++
      if (encryptError) throw encryptError
      return Buffer.from(encryptionPrefix + value, 'utf-8')
    },
    decryptString: (encrypted: Buffer) => {
      syncDecryptCalls++
      if (decryptError) throw decryptError
      return Buffer.from(encrypted)
        .toString('utf-8')
        .replace(/^(enc:|rot:)/, '')
    }
  }
}))

vi.mock('../../utils/dirs', () => ({
  pluginVaultDir: () => TMP,
  pluginVaultPath: (id: string) => join(TMP, `${id}.bin`),
  logPath: () => join(TMP, 'app.log')
}))

vi.mock('../../utils/logger', () => ({
  logger: { warn: vi.fn(async () => undefined) }
}))

function sampleVault(): IPluginVault {
  return {
    devicePrivKey: Buffer.alloc(32, 1).toString('base64'),
    deviceId: '11111111-1111-4111-8111-111111111111',
    gateway: {
      gateway: 'https://gw.front.com',
      gateways: ['https://gw.front.com'],
      endpoints: {
        enroll: '/enroll',
        challenge: '/challenge',
        config: '/config',
        revoke: '/revoke'
      }
    }
  }
}

// 旧形态（升级前写出的 vault）：只有 gateway.gateway，没有 gateways / lastGood
function legacyVault(): unknown {
  const v = sampleVault() as unknown as { gateway: Record<string, unknown> }
  delete v.gateway.gateways
  return v
}

function encryptedVault(vault: unknown = sampleVault()): Buffer {
  return Buffer.from('enc:' + JSON.stringify(vault), 'utf-8')
}

beforeEach(() => {
  TMP = mkdtempSync(join(tmpdir(), 'cpxvault-'))
  // the generic cases describe the non-Linux path (no backend / canary checks); Linux cases opt in explicitly.
  // restored by afterEach's vi.restoreAllMocks(), so the CI runner's real platform never leaks in
  vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin')
  encryptionAvailable = true
  asyncApiSupported = true
  decryptError = undefined
  encryptError = undefined
  shouldReEncrypt = false
  encryptionPrefix = 'enc:'
  linuxBackend = 'gnome_libsecret'
  encryptCalls = 0
  decryptCalls = 0
  syncEncryptCalls = 0
  syncDecryptCalls = 0
  decryptGate = undefined
})

afterEach(() => {
  vi.restoreAllMocks()
  rmSync(TMP, { recursive: true, force: true })
})

describe('persistent async vault', () => {
  it('round-trips through an encrypted file', async () => {
    await writeVault('p1', sampleVault())
    expect(existsSync(join(TMP, 'p1.bin'))).toBe(true)

    const out = await readVault('p1')
    expect(out.kind).toBe('ok')
    if (out.kind === 'ok') {
      expect(out.vault.deviceId).toBe('11111111-1111-4111-8111-111111111111')
      expect(out.vault.gateway.gateway).toBe('https://gw.front.com')
    }
  })

  it('removes the file and reports it missing', async () => {
    await writeVault('p1', sampleVault())
    await removeVault('p1')
    expect(existsSync(join(TMP, 'p1.bin'))).toBe(false)
    expect(await readVault('p1')).toEqual({ kind: 'missing' })
  })

  it('reports persistent async encryption availability', async () => {
    expect(await isVaultPersistent()).toBe(true)
  })

  it('decrypts a legacy sync ciphertext after a cold launch', async () => {
    writeFileSync(join(TMP, 'legacy.bin'), encryptedVault())
    vi.resetModules()
    const fresh = await import('./vault')

    const out = await fresh.readVault('legacy')
    expect(out.kind).toBe('ok')
    if (out.kind === 'ok') expect(out.vault.gateway.gateway).toBe('https://gw.front.com')
  })

  it('checks material presence without touching safeStorage', async () => {
    writeFileSync(join(TMP, 'present.bin'), encryptedVault())
    vi.resetModules()
    const fresh = await import('./vault')

    expect(fresh.hasVaultMaterial('present')).toBe(true)
    expect(decryptCalls).toBe(0)
  })

  it('re-encrypts valid rotated data atomically', async () => {
    writeFileSync(join(TMP, 'rotate.bin'), encryptedVault())
    shouldReEncrypt = true
    encryptionPrefix = 'rot:'
    vi.resetModules()
    const fresh = await import('./vault')

    expect((await fresh.readVault('rotate')).kind).toBe('ok')
    expect(encryptCalls).toBe(1)
    expect(readFileSync(join(TMP, 'rotate.bin'), 'utf-8')).toMatch(/^rot:/)
  })

  it('keeps a successfully decrypted vault usable when best-effort rotation fails', async () => {
    const original = encryptedVault()
    writeFileSync(join(TMP, 'rotate-failure.bin'), original)
    shouldReEncrypt = true
    encryptError = new Error('key rotation failed')
    vi.resetModules()
    const fresh = await import('./vault')

    expect((await fresh.readVault('rotate-failure')).kind).toBe('ok')
    expect(readFileSync(join(TMP, 'rotate-failure.bin'))).toEqual(original)
  })

  it('classifies structurally invalid plaintext as invalid', async () => {
    writeFileSync(
      join(TMP, 'bad.bin'),
      encryptedVault({ devicePrivKey: 'short', deviceId: 'not-a-uuid' })
    )
    vi.resetModules()
    const fresh = await import('./vault')

    expect(await fresh.readVault('bad')).toEqual({ kind: 'invalid' })
  })

  it('rejects forbidden gateway origins and malformed endpoints', async () => {
    const base = {
      devicePrivKey: Buffer.alloc(32, 1).toString('base64'),
      deviceId: '11111111-1111-4111-8111-111111111111'
    }
    const endpoints = { enroll: '/e', challenge: '/c', config: '/cfg', revoke: '/r' }
    const cases: Array<[string, unknown]> = [
      ['local', { ...base, gateway: { gateway: 'https://localhost', endpoints } }],
      [
        'protocol-relative',
        {
          ...base,
          gateway: {
            gateway: 'https://gw.front.com',
            endpoints: { ...endpoints, config: '//evil/cfg' }
          }
        }
      ]
    ]
    for (const [id, value] of cases) writeFileSync(join(TMP, `${id}.bin`), encryptedVault(value))
    vi.resetModules()
    const fresh = await import('./vault')

    for (const [id] of cases) expect(await fresh.readVault(id)).toEqual({ kind: 'invalid' })
  })

  it('distinguishes temporary keychain unavailability from invalid ciphertext', async () => {
    writeFileSync(join(TMP, 'temporary.bin'), encryptedVault())
    decryptError = new Error(
      'safeStorage.decryptStringAsync is temporarily unavailable. Please try again.'
    )
    vi.resetModules()
    const fresh = await import('./vault')
    expect(await fresh.readVault('temporary')).toEqual({ kind: 'unavailable' })

    decryptError = new Error('Error while decrypting ciphertext')
    expect(await fresh.readVault('temporary')).toEqual({ kind: 'invalid' })
  })
})

describe('parseVault / normalization (§2.3)', () => {
  it('normalizes a legacy vault (only gateway.gateway) into gateways: [gateway]', () => {
    const v = parseVault(legacyVault())
    expect(v?.gateway.gateways).toEqual(['https://gw.front.com'])
    expect(v?.gateway.gateway).toBe('https://gw.front.com')
    expect(v?.gateway.lastGood).toBeUndefined()
  })
  it('readVault returns the normalized object for a legacy ciphertext', async () => {
    writeFileSync(join(TMP, 'legacy2.bin'), encryptedVault(legacyVault()))
    vi.resetModules()
    const fresh = await import('./vault')
    const out = await fresh.readVault('legacy2')
    expect(out.kind).toBe('ok')
    if (out.kind === 'ok') expect(out.vault.gateway.gateways).toEqual(['https://gw.front.com'])
  })
  it('drops lastGood when it is not in gateways, keeping the rest', () => {
    const raw = sampleVault()
    raw.gateway.gateways = ['https://gw.front.com', 'https://gw2.front.com']
    raw.gateway.lastGood = 'https://gw9.front.com'
    const v = parseVault(raw)
    expect(v?.gateway.lastGood).toBeUndefined()
    expect(v?.gateway.gateways).toEqual(['https://gw.front.com', 'https://gw2.front.com'])
    expect(v?.gateway.gateway).toBe('https://gw.front.com')
  })
  it('keeps a valid lastGood and mirrors it into gateway.gateway', () => {
    const raw = sampleVault()
    raw.gateway.gateways = ['https://gw.front.com', 'https://gw2.front.com']
    raw.gateway.lastGood = 'https://gw2.front.com'
    const v = parseVault(raw)
    expect(v?.gateway.lastGood).toBe('https://gw2.front.com')
    expect(v?.gateway.gateway).toBe('https://gw2.front.com')
  })
  it('R2-ISS-006: a non-canonical lastGood spelling is normalized instead of silently dropped', () => {
    const raw = sampleVault()
    raw.gateway.gateways = ['https://gw.front.com', 'https://GW2.front.com:443/']
    raw.gateway.lastGood = 'https://GW2.front.com:443/'
    const v = parseVault(raw)
    expect(v?.gateway.gateways).toEqual(['https://gw.front.com', 'https://gw2.front.com'])
    expect(v?.gateway.lastGood).toBe('https://gw2.front.com')
    expect(v?.gateway.gateway).toBe('https://gw2.front.com')
  })
  it('R2-ISS-004: endpoint paths are normalized on read ("/v1/../config" → "/config")', () => {
    const raw = sampleVault()
    raw.gateway.endpoints = {
      ...raw.gateway.endpoints,
      config: '/v1/../config',
      revoke: '/./revoke'
    }
    const v = parseVault(raw)
    expect(v?.gateway.endpoints.config).toBe('/config')
    expect(v?.gateway.endpoints.revoke).toBe('/revoke')
  })
  it('R2-ISS-064: staleDevices round-trips and malformed entries are dropped', async () => {
    const good = {
      deviceId: '33333333-3333-4333-8333-333333333333',
      devicePrivKey: sampleVault().devicePrivKey
    }
    const raw = {
      ...sampleVault(),
      staleDevices: [
        good,
        { deviceId: 'nope', devicePrivKey: good.devicePrivKey },
        { deviceId: good.deviceId, devicePrivKey: 'short' },
        42
      ]
    }
    expect(parseVault(raw)?.staleDevices).toEqual([good])
    expect(parseVault({ ...sampleVault(), staleDevices: 'x' })?.staleDevices).toBeUndefined()
    await writeVault('stale', { ...sampleVault(), staleDevices: [good] })
    const out = await readVault('stale')
    expect(out.kind === 'ok' && out.vault.staleDevices).toEqual([good])
    // pruning to an empty list drops the field entirely
    await updateVault('stale', (v) => ({ ...v, staleDevices: [] }))
    const pruned = await readVault('stale')
    expect(pruned.kind === 'ok' && 'staleDevices' in pruned.vault).toBe(false)
  })

  it('ignores unknown fields (e.g. a bootstrap block from a newer version)', () => {
    const raw = { ...sampleVault(), bootstrap: { proxies: 'garbage' } }
    const v = parseVault(raw)
    expect(v).not.toBeNull()
    expect((v as unknown as Record<string, unknown>).bootstrap).toBeUndefined()
  })
  it('rejects a malformed gateways list', () => {
    const raw = sampleVault()
    raw.gateway.gateways = ['https://gw.front.com', 'http://plain']
    expect(parseVault(raw)).toBeNull()
  })
  it('writes gateway.gateway = lastGood ?? gateways[0] to disk (downgrade mirror)', async () => {
    const v = sampleVault()
    v.gateway.gateways = ['https://gw.front.com', 'https://gw2.front.com']
    v.gateway.lastGood = 'https://gw2.front.com'
    v.gateway.gateway = 'https://stale.example'
    await writeVault('mirror', v)
    const onDisk = JSON.parse(readFileSync(join(TMP, 'mirror.bin'), 'utf-8').replace(/^enc:/, ''))
    expect(onDisk.gateway.gateway).toBe('https://gw2.front.com')
    expect(onDisk.gateway.lastGood).toBe('https://gw2.front.com')
    const again = {
      ...sampleVault(),
      gateway: { ...sampleVault().gateway, gateways: ['https://gw.front.com'] }
    }
    await writeVault('mirror2', again)
    const onDisk2 = JSON.parse(readFileSync(join(TMP, 'mirror2.bin'), 'utf-8').replace(/^enc:/, ''))
    expect(onDisk2.gateway.gateway).toBe('https://gw.front.com')
    expect('lastGood' in onDisk2.gateway).toBe(false)
  })
  it('updateVault skips the write when the mutator returns the same object', async () => {
    await writeVault('same', sampleVault())
    const before = readFileSync(join(TMP, 'same.bin'))
    encryptionPrefix = 'rot:'
    expect(await updateVault('same', (v) => v)).toBe(true)
    expect(readFileSync(join(TMP, 'same.bin'))).toEqual(before)
  })
})

describe('removeVaultIfDevice (R2-ISS-021)', () => {
  it("removes only a vault that belongs to the given device; keeps another device's vault", async () => {
    const v = sampleVault() as unknown as IPluginVault
    await writeVault('dev', v)
    expect(await removeVaultIfDevice('dev', 'not-this-device')).toBe(false)
    expect((await readVault('dev')).kind).toBe('ok')
    expect(await removeVaultIfDevice('dev', v.deviceId)).toBe(true)
    expect((await readVault('dev')).kind).toBe('missing')
    expect(await removeVaultIfDevice('dev', v.deviceId)).toBe(false)
  })
})

describe('vault lock', () => {
  it('serializes concurrent updateVault calls so neither change is lost', async () => {
    const base = sampleVault()
    base.gateway.gateways = ['https://gw.front.com', 'https://gw2.front.com']
    await writeVault('lock', base)
    const ep = sampleVault().gateway.endpoints
    await Promise.all([
      updateVault('lock', (v) => ({
        ...v,
        gateway: { ...v.gateway, lastGood: 'https://gw2.front.com' }
      })),
      updateVault('lock', (v) => ({
        ...v,
        gateway: { ...v.gateway, endpoints: { ...ep, config: '/cfg2' } }
      }))
    ])
    const out = await readVault('lock')
    expect(out.kind).toBe('ok')
    if (out.kind === 'ok') {
      expect(out.vault.gateway.lastGood).toBe('https://gw2.front.com')
      expect(out.vault.gateway.gateway).toBe('https://gw2.front.com')
      expect(out.vault.gateway.endpoints.config).toBe('/cfg2')
    }
  })

  it('does not resurrect a vault through a queued updateVault after removeVault', async () => {
    await writeVault('gone', sampleVault())
    const removed = removeVault('gone')
    const updated = updateVault('gone', (v) => ({ ...v, deviceId: v.deviceId }))
    await removed
    expect(await updated).toBe(false)
    expect(existsSync(join(TMP, 'gone.bin'))).toBe(false)
    expect(await readVault('gone')).toEqual({ kind: 'missing' })
  })

  it('does not resurrect a vault through a cache-miss readVault queued behind removeVault', async () => {
    writeFileSync(join(TMP, 'miss.bin'), encryptedVault())
    vi.resetModules()
    const fresh = await import('./vault')
    const removed = fresh.removeVault('miss')
    const read = fresh.readVault('miss')
    await removed
    expect(await read).toEqual({ kind: 'missing' })
    expect(fresh.hasVaultMaterial('miss')).toBe(false)
  })

  it('BL-005 (ISS-019): a decrypt that outlives the budget releases the caller, keeps the lock, and lands late', async () => {
    writeFileSync(join(TMP, 'slow.bin'), encryptedVault())
    let open!: () => void
    decryptGate = new Promise<void>((r) => {
      open = r
    })
    const ac = new AbortController()
    const read = readVault('slow', ac.signal)
    await new Promise((r) => setTimeout(r, 10))
    expect(decryptCalls).toBe(1) // inside the lock, decrypting
    let mutated = false
    const queued = updateVault('slow', (v) => {
      mutated = true
      return { ...v, gateway: { ...v.gateway, lastGood: 'https://gw.front.com' } }
    })
    ac.abort(new Error('budget exhausted'))
    // the caller is released at the budget with the op's timeout code…
    await expect(read).rejects.toMatchObject({ code: 'CPX_TIMEOUT' })
    await new Promise((r) => setTimeout(r, 10))
    // …but the lock is still held by the in-flight decrypt: the queued write has not run
    expect(mutated).toBe(false)
    open()
    expect(await queued).toBe(true)
    expect(mutated).toBe(true)
    // the late decrypt filled the cache; the queued write re-read from it rather than decrypting again
    expect(decryptCalls).toBe(1)
    const out = await readVault('slow')
    expect(out.kind).toBe('ok')
    if (out.kind === 'ok') expect(out.vault.gateway.lastGood).toBe('https://gw.front.com')
  })

  it('R2-ISS-055: an already-aborted signal rejects with CPX_TIMEOUT and leaves no unhandled rejection', async () => {
    writeFileSync(join(TMP, 'pre.bin'), encryptedVault())
    let unhandled = 0
    const onUnhandled = (): void => {
      unhandled++
    }
    process.on('unhandledRejection', onUnhandled)
    try {
      const ac = new AbortController()
      ac.abort(new Error('budget exhausted'))
      await expect(readVault('pre', ac.signal)).rejects.toMatchObject({ code: 'CPX_TIMEOUT' })
      await new Promise((r) => setTimeout(r, 20))
      expect(unhandled).toBe(0)
    } finally {
      process.off('unhandledRejection', onUnhandled)
    }
  })

  it('R2-ISS-019: the synchronous compat decrypt is not started once the budget is gone', async () => {
    asyncApiSupported = false
    writeFileSync(join(TMP, 'syncv.bin'), encryptedVault())
    const ac = new AbortController()
    const read = readVault('syncv', ac.signal)
    ac.abort(new Error('budget exhausted')) // before the lock task reaches the decrypt
    await expect(read).rejects.toMatchObject({ code: 'CPX_TIMEOUT' })
    await new Promise((r) => setTimeout(r, 20))
    expect(syncDecryptCalls).toBe(0)
    // a later read (no budget pressure) decrypts normally
    expect((await readVault('syncv')).kind).toBe('ok')
    expect(syncDecryptCalls).toBe(1)
  })

  it('aborts a queued write when the signal fires while waiting for the lock', async () => {
    await writeVault('abort', sampleVault())
    let release!: () => void
    const holding = withVaultLock(
      'abort',
      () =>
        new Promise<void>((r) => {
          release = r
        })
    )
    const ac = new AbortController()
    const queued = updateVault('abort', (v) => ({ ...v, deviceId: v.deviceId }), ac.signal)
    ac.abort(new Error('budget exhausted'))
    await expect(queued).rejects.toThrow('budget exhausted')
    release()
    await holding
    expect((await readVault('abort')).kind).toBe('ok')
  })
})

describe('storage backend unavailable', () => {
  it('treats unavailable macOS/Windows storage as transient', async () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin')
    encryptionAvailable = false
    writeFileSync(join(TMP, 'existing.bin'), encryptedVault())
    vi.resetModules()
    const fresh = await import('./vault')

    expect(await fresh.readVault('existing')).toEqual({ kind: 'unavailable' })
    await expect(fresh.writeVault('new', sampleVault())).rejects.toMatchObject({
      name: VaultUnavailableError.name
    })
  })

  it('R2-ISS-061: Linux with the basic_text (fixed-key) backend keeps the vault in memory even though async encryption reports available', async () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('linux')
    linuxBackend = 'basic_text'
    writeFileSync(join(TMP, 'fixed.bin'), encryptedVault())
    vi.resetModules()
    const fresh = await import('./vault')

    await fresh.writeVault('linux-basic', sampleVault())
    expect(existsSync(join(TMP, 'linux-basic.bin'))).toBe(false)
    expect(encryptCalls).toBe(0) // never encrypts with the fixed key
    expect(await fresh.isVaultPersistent()).toBe(false)
    expect((await fresh.readVault('linux-basic')).kind).toBe('ok')
    // an existing ciphertext is not decrypted / re-encrypted through that backend either
    expect(await fresh.readVault('fixed')).toEqual({ kind: 'unavailable' })
    expect(decryptCalls).toBe(0)
  })

  it('R2-ISS-061 (V1): a secure backend name whose ciphertext carries the fixed-key prefix is still kept in memory', async () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('linux')
    linuxBackend = 'kwallet6'
    encryptionPrefix = 'v10' // the store failed to initialise → Chromium fell back to the hardcoded key
    vi.resetModules()
    const fresh = await import('./vault')
    await fresh.writeVault('linux-v10', sampleVault())
    expect(existsSync(join(TMP, 'linux-v10.bin'))).toBe(false)
    expect(await fresh.isVaultPersistent()).toBe(false)
    expect(encryptCalls).toBe(1) // the canary only; the vault itself was never encrypted with that key
  })

  it('R2-ISS-061 (V1): a canary that throws (secret store momentarily unavailable) is not a fixed-key verdict', async () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('linux')
    linuxBackend = 'gnome_libsecret'
    writeFileSync(join(TMP, 'flaky.bin'), encryptedVault())
    vi.resetModules()
    const fresh = await import('./vault')
    encryptError = new Error(
      'safeStorage.encryptStringAsync is temporarily unavailable. Please try again.'
    )
    // reads still work: the decrypt path is judged on its own
    expect((await fresh.readVault('flaky')).kind).toBe('ok')
    // writes fail on their own path, nothing lands under an unverified key
    await expect(fresh.writeVault('flaky-w', sampleVault())).rejects.toMatchObject({
      name: VaultUnavailableError.name
    })
    expect(existsSync(join(TMP, 'flaky-w.bin'))).toBe(false)
    // once the store is back the verdict is taken normally and persistence resumes
    encryptError = undefined
    await fresh.writeVault('flaky-w', sampleVault())
    expect(existsSync(join(TMP, 'flaky-w.bin'))).toBe(true)
  })

  it('R2-ISS-061 (V1): a v11 (system secret store) ciphertext prefix persists normally', async () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('linux')
    linuxBackend = 'gnome_libsecret'
    encryptionPrefix = 'v11'
    vi.resetModules()
    const fresh = await import('./vault')
    await fresh.writeVault('linux-v11', sampleVault())
    expect(existsSync(join(TMP, 'linux-v11.bin'))).toBe(true)
    expect((await fresh.readVault('linux-v11')).kind).toBe('ok')
  })

  it('R2-ISS-061: Linux with a system secret store persists normally', async () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('linux')
    linuxBackend = 'kwallet6'
    vi.resetModules()
    const fresh = await import('./vault')
    await fresh.writeVault('linux-kw', sampleVault())
    expect(existsSync(join(TMP, 'linux-kw.bin'))).toBe(true)
    expect(await fresh.isVaultPersistent()).toBe(true)
  })

  it('keeps Linux vaults in memory when no async backend exists', async () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('linux')
    encryptionAvailable = false
    vi.resetModules()
    const fresh = await import('./vault')

    await fresh.writeVault('linux', sampleVault())
    expect(existsSync(join(TMP, 'linux.bin'))).toBe(false)
    expect(fresh.hasVaultMaterial('linux')).toBe(true)
    expect((await fresh.readVault('linux')).kind).toBe('ok')
    expect(await fresh.isVaultPersistent()).toBe(false)
  })
})

describe('legacy Electron compatibility', () => {
  it('falls back to synchronous safeStorage when async APIs do not exist', async () => {
    asyncApiSupported = false
    vi.resetModules()
    const legacy = await import('./vault')

    await legacy.ensureVaultWritable()
    await legacy.writeVault('legacy-electron', sampleVault())
    expect(syncEncryptCalls).toBe(2)
    expect(encryptCalls).toBe(0)

    vi.resetModules()
    const fresh = await import('./vault')
    const result = await fresh.readVault('legacy-electron')
    expect(result.kind).toBe('ok')
    expect(syncDecryptCalls).toBe(1)
    expect(decryptCalls).toBe(0)
  })
})
