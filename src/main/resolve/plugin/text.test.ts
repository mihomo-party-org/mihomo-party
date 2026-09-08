import { describe, it, expect } from 'vitest'
import { sanitizeProviderText } from './text'

describe('sanitizeProviderText (§4.2)', () => {
  it('trims and keeps newlines while stripping other control characters', () => {
    expect(sanitizeProviderText('  a\u0001b\nc\u007fd\te  ', 200)).toBe('ab\ncde')
  })
  it('truncates by code points, not UTF-16 units', () => {
    const emoji = '😀'.repeat(201)
    expect(Array.from(sanitizeProviderText(emoji, 200) ?? '')).toHaveLength(200)
  })
  it('treats empty / whitespace-only / non-string as absent', () => {
    expect(sanitizeProviderText('   ', 10)).toBeUndefined()
    expect(sanitizeProviderText('\u0000\u0001', 10)).toBeUndefined()
    expect(sanitizeProviderText(42, 10)).toBeUndefined()
    expect(sanitizeProviderText(undefined, 10)).toBeUndefined()
  })
})
