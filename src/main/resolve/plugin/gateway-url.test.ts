import { describe, it, expect } from 'vitest'
import {
  parseGatewayOrigin,
  parseGatewayList,
  isValidEndpointPath,
  normalizeEndpointPath
} from './gateway-url'

describe('parseGatewayOrigin', () => {
  it('accepts a plain https origin and returns it normalized', () => {
    expect(parseGatewayOrigin('https://gw.front.com')).toBe('https://gw.front.com')
    expect(parseGatewayOrigin('https://gw.front.com:8443')).toBe('https://gw.front.com:8443')
    expect(parseGatewayOrigin('https://gw.front.com/')).toBe('https://gw.front.com')
  })
  it('rejects non-https', () => {
    expect(parseGatewayOrigin('http://gw.front.com')).toBeNull()
  })
  it('rejects path/query/fragment', () => {
    expect(parseGatewayOrigin('https://gw.front.com/base')).toBeNull()
    expect(parseGatewayOrigin('https://gw.front.com/?x=1')).toBeNull()
    expect(parseGatewayOrigin('https://gw.front.com/#f')).toBeNull()
  })
  it('rejects userinfo', () => {
    expect(parseGatewayOrigin('https://u:p@gw.front.com')).toBeNull()
  })
  it('rejects private IP, loopback IP, and localhost names', () => {
    expect(parseGatewayOrigin('https://127.0.0.1')).toBeNull()
    expect(parseGatewayOrigin('https://10.0.0.5')).toBeNull()
    expect(parseGatewayOrigin('https://[::1]')).toBeNull()
    expect(parseGatewayOrigin('https://localhost')).toBeNull()
    expect(parseGatewayOrigin('https://foo.localhost')).toBeNull()
    expect(parseGatewayOrigin('https://localhost.')).toBeNull()
  })
  it('rejects non-string', () => {
    expect(parseGatewayOrigin(123)).toBeNull()
    expect(parseGatewayOrigin(undefined)).toBeNull()
  })
})

describe('normalizeEndpointPath (R2-ISS-004/031)', () => {
  it('resolves . and .. to the path the request will use, idempotently', () => {
    expect(normalizeEndpointPath('/v1/../config')).toBe('/config')
    expect(normalizeEndpointPath('/./revoke')).toBe('/revoke')
    expect(normalizeEndpointPath('/config')).toBe('/config')
  })
  it('keeps a path that collapses to "//x" on the same origin and stays idempotent', () => {
    const once = normalizeEndpointPath('/a/..//enroll')
    expect(once).toBe('/.//enroll')
    expect(normalizeEndpointPath(once)).toBe(once)
    expect(isValidEndpointPath(once)).toBe(true)
    expect(new URL(once, 'https://gw.example').host).toBe('gw.example')
  })
})

describe('isValidEndpointPath', () => {
  it('accepts a relative path starting with /', () => {
    expect(isValidEndpointPath('/config')).toBe(true)
    expect(isValidEndpointPath('/v2/config')).toBe(true)
  })
  it('rejects protocol-relative, absolute, query/fragment, non-string', () => {
    expect(isValidEndpointPath('//evil.example/config')).toBe(false)
    expect(isValidEndpointPath('https://evil.example/config')).toBe(false)
    expect(isValidEndpointPath('/config?x=1')).toBe(false)
    expect(isValidEndpointPath('/config#f')).toBe(false)
    expect(isValidEndpointPath('config')).toBe(false)
    expect(isValidEndpointPath(42)).toBe(false)
  })
  it('rejects backslash host-escape (WHATWG treats \\ as / under https)', () => {
    // new URL('/\\evil.example/config', 'https://gw') === https://evil.example/config
    expect(isValidEndpointPath('/\\evil.example/config')).toBe(false)
    expect(isValidEndpointPath('/\\localhost/config')).toBe(false)
    expect(isValidEndpointPath('/foo\\bar')).toBe(false)
  })
})

describe('parseGatewayList', () => {
  it('normalizes and deduplicates 1..3 origins', () => {
    expect(parseGatewayList(['https://a.com/', 'https://b.com', 'https://a.com'])).toEqual([
      'https://a.com',
      'https://b.com'
    ])
  })
  it('rejects empty, oversized, non-array, and lists with any invalid origin', () => {
    expect(parseGatewayList([])).toBeNull()
    expect(parseGatewayList(['https://a', 'https://b', 'https://c', 'https://d'])).toBeNull()
    expect(parseGatewayList('https://a.com')).toBeNull()
    expect(parseGatewayList(['https://a.com', 'http://b.com'])).toBeNull()
    expect(parseGatewayList(['https://a.com', 'https://localhost'])).toBeNull()
  })
})
