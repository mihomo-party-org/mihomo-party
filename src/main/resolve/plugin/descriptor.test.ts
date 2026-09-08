import { describe, it, expect } from 'vitest'
import { parseDescriptor } from './descriptor'

const PNG = 'data:image/png;base64,iVBOR'
function file(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    magic: 'CPXF',
    v: 2,
    spec: 'cpx-plugin/2',
    loginUrl: 'https://panel.xx.com/oauth/authorize',
    provider: { name: 'XX', icon: PNG, site: 'https://xx.com' },
    ...over
  })
}

describe('parseDescriptor', () => {
  it('accepts a valid descriptor', () => {
    const d = parseDescriptor(file())
    expect(d.loginUrl).toBe('https://panel.xx.com/oauth/authorize')
    expect(d.provider.name).toBe('XX')
  })
  it('rejects non-https loginUrl', () => {
    expect(() => parseDescriptor(file({ loginUrl: 'http://panel.xx.com/a' }))).toThrow()
  })
  it('rejects loginUrl with query', () => {
    expect(() => parseDescriptor(file({ loginUrl: 'https://panel.xx.com/a?x=1' }))).toThrow()
  })
  it('rejects loginUrl with fragment', () => {
    expect(() => parseDescriptor(file({ loginUrl: 'https://panel.xx.com/a#f' }))).toThrow()
  })
  it('rejects loginUrl with a loopback IP literal', () => {
    expect(() => parseDescriptor(file({ loginUrl: 'https://127.0.0.1/oauth' }))).toThrow()
  })
  it('rejects loginUrl with a private IP literal', () => {
    expect(() => parseDescriptor(file({ loginUrl: 'https://10.0.0.5/oauth' }))).toThrow()
  })
  it('rejects loginUrl with an IPv6 loopback literal', () => {
    expect(() => parseDescriptor(file({ loginUrl: 'https://[::1]/oauth' }))).toThrow()
  })
  it('rejects loginUrl pointing at localhost', () => {
    expect(() => parseDescriptor(file({ loginUrl: 'https://localhost/oauth' }))).toThrow()
  })
  it('rejects loginUrl pointing at a *.localhost name', () => {
    expect(() => parseDescriptor(file({ loginUrl: 'https://foo.localhost/oauth' }))).toThrow()
  })
  it('rejects loginUrl pointing at localhost. (trailing dot)', () => {
    expect(() => parseDescriptor(file({ loginUrl: 'https://localhost./oauth' }))).toThrow()
  })
  it('rejects loginUrl with userinfo', () => {
    expect(() => parseDescriptor(file({ loginUrl: 'https://u:p@panel.xx.com/oauth' }))).toThrow()
  })
  it('rejects a private IP literal in provider.site', () => {
    expect(() =>
      parseDescriptor(file({ provider: { name: 'X', site: 'https://192.168.1.1' } }))
    ).toThrow()
  })
  it('rejects unknown top-level fields', () => {
    expect(() => parseDescriptor(file({ extra: 1 }))).toThrow()
  })
  it('rejects svg icon', () => {
    expect(() =>
      parseDescriptor(file({ provider: { name: 'X', icon: 'data:image/svg+xml,<svg/>' } }))
    ).toThrow()
  })
  it('rejects external icon url', () => {
    expect(() =>
      parseDescriptor(file({ provider: { name: 'X', icon: 'https://x.com/a.png' } }))
    ).toThrow()
  })
  it('rejects oversized icon', () => {
    const big = 'data:image/png;base64,' + 'A'.repeat(64 * 1024 + 1)
    expect(() => parseDescriptor(file({ provider: { name: 'X', icon: big } }))).toThrow()
  })
  it('rejects non-https site', () => {
    expect(() =>
      parseDescriptor(file({ provider: { name: 'X', site: 'http://xx.com' } }))
    ).toThrow()
  })
  it('rejects wrong spec', () => {
    expect(() => parseDescriptor(file({ spec: 'cpx-plugin/1' }))).toThrow()
  })
  it('gives a specific error for a v1 file', () => {
    expect(() => parseDescriptor(JSON.stringify({ magic: 'CPXF', v: 1 }))).toThrow(/v1/)
  })
  it('rejects invalid JSON', () => {
    expect(() => parseDescriptor('{not json')).toThrow()
  })
  it('rejects non-object JSON (e.g. a string)', () => {
    expect(() => parseDescriptor('"just a string"')).toThrow()
  })
  it('rejects wrong magic', () => {
    expect(() => parseDescriptor(file({ magic: 'OOPS' }))).toThrow()
  })
  it('rejects unknown provider fields', () => {
    expect(() => parseDescriptor(file({ provider: { name: 'X', extra: 1 } }))).toThrow()
  })
  it('rejects missing/empty provider.name', () => {
    expect(() => parseDescriptor(file({ provider: { name: '' } }))).toThrow()
  })

  // §3 discoveryUrls
  it('accepts 1..8 backup discovery origins and normalizes them', () => {
    const d = parseDescriptor(
      file({ discoveryUrls: ['https://cdn.xx.com/', 'https://gw.xx.com:8443'] })
    )
    expect(d.discoveryUrls).toEqual(['https://cdn.xx.com', 'https://gw.xx.com:8443'])
  })
  it('rejects 9 discovery origins', () => {
    const nine = Array.from({ length: 9 }, (_, i) => `https://d${i}.xx.com`)
    expect(() => parseDescriptor(file({ discoveryUrls: nine }))).toThrow(/discoveryUrls/)
  })
  it('rejects an empty discoveryUrls list', () => {
    expect(() => parseDescriptor(file({ discoveryUrls: [] }))).toThrow(/discoveryUrls/)
  })
  it('rejects a discovery origin with a path', () => {
    expect(() => parseDescriptor(file({ discoveryUrls: ['https://cdn.xx.com/wk'] }))).toThrow(
      /discoveryUrls/
    )
  })
  it('rejects a discovery origin equal to the loginUrl origin', () => {
    expect(() => parseDescriptor(file({ discoveryUrls: ['https://panel.xx.com'] }))).toThrow(
      /loginUrl origin/
    )
  })
  it('rejects a private discovery origin', () => {
    expect(() => parseDescriptor(file({ discoveryUrls: ['https://10.0.0.1'] }))).toThrow(
      /discoveryUrls/
    )
  })
  it('rejects duplicate discovery origins (after normalization)', () => {
    expect(() =>
      parseDescriptor(file({ discoveryUrls: ['https://cdn.xx.com', 'https://cdn.xx.com/'] }))
    ).toThrow(/duplicates/)
  })

  // §4 provider.description
  it('accepts provider.description and sanitizes it', () => {
    const d = parseDescriptor(
      file({ provider: { name: 'X', description: '  line1\u0001\nline2  ' } })
    )
    expect(d.provider.description).toBe('line1\nline2')
  })
  it('truncates provider.description to 500 code points', () => {
    const d = parseDescriptor(file({ provider: { name: 'X', description: '字'.repeat(501) } }))
    expect(Array.from(d.provider.description ?? '')).toHaveLength(500)
  })
  it('drops an empty provider.description and rejects a non-string one', () => {
    expect(
      parseDescriptor(file({ provider: { name: 'X', description: '   ' } })).provider.description
    ).toBeUndefined()
    expect(() => parseDescriptor(file({ provider: { name: 'X', description: 1 } }))).toThrow()
  })

  // §5 providerPubKey
  it('accepts a 32-byte standard-base64 providerPubKey', () => {
    const key = Buffer.alloc(32, 9).toString('base64')
    expect(parseDescriptor(file({ providerPubKey: key })).providerPubKey).toBe(key)
  })
  it('rejects a providerPubKey that is not exactly 32 canonical base64 bytes', () => {
    expect(() =>
      parseDescriptor(file({ providerPubKey: Buffer.alloc(31, 9).toString('base64') }))
    ).toThrow(/providerPubKey/)
    expect(() =>
      parseDescriptor(file({ providerPubKey: Buffer.alloc(32, 9).toString('base64url') }))
    ).toThrow(/providerPubKey/)
    expect(() => parseDescriptor(file({ providerPubKey: 42 }))).toThrow(/providerPubKey/)
  })
})
