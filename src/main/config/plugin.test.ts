import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

let TMP = ''
vi.mock('../utils/dirs', () => ({
  pluginConfigPath: () => join(TMP, 'plugin.yaml'),
  appConfigPath: () => join(TMP, 'app.yaml')
}))

import {
  getPluginConfig,
  addPluginItem,
  getPluginItem,
  updatePluginItem,
  patchPluginItem,
  removePluginItem,
  normalizeDiscoveryMarker
} from './plugin'

function item(id: string): IPluginItem {
  return {
    id,
    name: 'X',
    loginUrl: 'https://panel.x.com/oauth/authorize',
    spec: 'cpx-plugin/2',
    profileId: `prof-${id}`,
    status: 'active',
    created: 1,
    updated: 1
  }
}

beforeEach(() => {
  TMP = mkdtempSync(join(tmpdir(), 'cpxcfg-'))
  writeFileSync(join(TMP, 'app.yaml'), '{}')
})
afterEach(() => rmSync(TMP, { recursive: true, force: true }))

describe('plugin config CRUD', () => {
  it('starts empty', async () => {
    expect((await getPluginConfig(true)).items).toEqual([])
  })
  it('adds and reads back an item', async () => {
    await addPluginItem(item('a'))
    expect((await getPluginItem('a'))?.name).toBe('X')
    expect((await getPluginConfig(true)).items).toHaveLength(1)
  })
  it('updates an item', async () => {
    await addPluginItem(item('a'))
    await updatePluginItem({ ...item('a'), status: 'needs-reauth' })
    expect((await getPluginItem('a'))?.status).toBe('needs-reauth')
  })
  it('patches an item', async () => {
    await addPluginItem(item('a'))
    await patchPluginItem('a', { useProxy: true })
    expect((await getPluginItem('a'))?.useProxy).toBe(true)
  })
  it('removes an item', async () => {
    await addPluginItem(item('a'))
    await removePluginItem('a')
    expect(await getPluginItem('a')).toBeUndefined()
  })
  it('does not poison the write queue when update throws', async () => {
    await expect(updatePluginItem(item('missing'))).rejects.toThrow()
    await addPluginItem(item('after'))
    expect((await getPluginItem('after'))?.id).toBe('after')
  })
  it('addPluginItem upserts an existing id', async () => {
    await addPluginItem(item('dup'))
    await addPluginItem({ ...item('dup'), name: 'renamed' })
    const cfg = await getPluginConfig(true)
    expect(cfg.items.filter((i) => i.id === 'dup')).toHaveLength(1)
    expect((await getPluginItem('dup'))?.name).toBe('renamed')
  })
})

const DIGEST = 'a'.repeat(64)

describe('normalizeDiscoveryMarker (§5.3, ISS-011)', () => {
  it('keeps a well-formed pair', () => {
    const it1 = { ...item('m1'), discoverySeq: 12, discoveryDigest: DIGEST }
    normalizeDiscoveryMarker(it1)
    expect(it1.discoverySeq).toBe(12)
    expect(it1.discoveryDigest).toBe(DIGEST)
  })
  it('drops both when only one half is present or the digest is malformed', () => {
    const a = { ...item('m2'), discoverySeq: 12 }
    normalizeDiscoveryMarker(a)
    expect(a.discoverySeq).toBeUndefined()
    const b = { ...item('m3'), discoveryDigest: DIGEST }
    normalizeDiscoveryMarker(b)
    expect(b.discoveryDigest).toBeUndefined()
    const c = { ...item('m4'), discoverySeq: 1, discoveryDigest: 'nope' }
    normalizeDiscoveryMarker(c)
    expect(c.discoverySeq).toBeUndefined()
  })
  it('drops a seq that is not a safe integer ≥ 1', () => {
    for (const seq of [0, -1, 1.5, 2 ** 53, Number.MAX_VALUE]) {
      const it2 = { ...item('m5'), discoverySeq: seq, discoveryDigest: DIGEST }
      normalizeDiscoveryMarker(it2)
      expect(it2.discoverySeq).toBeUndefined()
      expect(it2.discoveryDigest).toBeUndefined()
    }
  })
  it('is applied when the config is read from disk', async () => {
    writeFileSync(
      join(TMP, 'plugin.yaml'),
      'items:\n  - id: d1\n    name: X\n    loginUrl: https://panel.x.com/oauth/authorize\n    spec: cpx-plugin/2\n    status: active\n    created: 1\n    updated: 1\n    discoverySeq: 5\n'
    )
    const cfg = await getPluginConfig(true)
    expect(cfg.items[0].discoverySeq).toBeUndefined()
  })
})
