import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { SortableContext } from '@dnd-kit/sortable'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getOverride,
  getOverrideConfig,
  getOverrideItem,
  setOverrideConfig,
  updateOverrideItem
} from './override'

let testDir = ''

vi.mock('../utils/dirs', () => ({
  overrideConfigPath: () => join(testDir, 'override.yaml'),
  overridePath: (id: string, ext: string) => join(testDir, `${id}.${ext}`)
}))
vi.mock('../utils/chromeRequest', () => ({ get: vi.fn() }))
vi.mock('./controledMihomo', () => ({ getControledMihomoConfig: vi.fn() }))

beforeEach(() => {
  testDir = mkdtempSync(join(tmpdir(), 'clash-party-override-test-'))
})

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true })
})

function writeConfig(id: string): void {
  writeFileSync(
    join(testDir, 'override.yaml'),
    `items:\n  - id: ${id}\n    name: Existing override\n    type: local\n    ext: js\n    updated: 0\n`
  )
}

describe('legacy numeric override IDs', () => {
  it.each([
    ['.inf', 'Infinity'],
    ['-.inf', '-Infinity'],
    ['.nan', 'NaN'],
    ['123456', '123456'],
    ['19e86409178', 'Infinity'],
    ['"19e86409178"', '19e86409178']
  ])('keeps %s usable after JSON transport', async (yamlId, expectedId) => {
    writeConfig(yamlId)
    const config = await getOverrideConfig(true)
    // SortableContext probes object IDs with `in`; null would throw here.
    const ids = JSON.parse(JSON.stringify(config)).items.map((item: IOverrideItem) => item.id)
    expect(() =>
      renderToString(<SortableContext items={ids}>{null}</SortableContext>)
    ).not.toThrow()
    expect(config.items[0].id).toBe(expectedId)
    expect((await getOverrideItem(expectedId))?.name).toBe('Existing override')
  })

  it('matches and persists the same ID during a queued update', async () => {
    writeConfig('.inf')
    const { items } = await getOverrideConfig(true)
    await updateOverrideItem({ ...items[0], global: true })
    const saved = await getOverrideConfig(true)
    expect(saved.items).toEqual([{ ...items[0], global: true }])
    expect(readFileSync(join(testDir, 'override.yaml'), 'utf8')).toContain('id: Infinity')
  })

  it('preserves access to the existing override file', async () => {
    writeConfig('.inf')
    writeFileSync(join(testDir, 'Infinity.js'), 'function main(config) { return config }')
    const { items } = await getOverrideConfig(true)
    expect(await getOverride(items[0].id, items[0].ext)).toContain('function main')
  })

  it('normalizes IDs before the setter JSON clone', async () => {
    writeConfig('.inf')
    const { items } = await getOverrideConfig(true)
    await setOverrideConfig({ items: [{ ...items[0], id: Infinity as unknown as string }] })
    expect((await getOverrideConfig(true)).items[0].id).toBe('Infinity')
  })
})
