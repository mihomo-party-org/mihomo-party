import { describe, it, expect } from 'vitest'
import {
  isPrivateIp,
  isForbiddenHost,
  createGuardedLookup,
  resolveAllPublicOrThrow
} from './net-guard'

describe('isForbiddenHost', () => {
  it('forbids localhost and its variants', () => {
    expect(isForbiddenHost('localhost')).toBe(true)
    expect(isForbiddenHost('LocalHost')).toBe(true)
    expect(isForbiddenHost('localhost.')).toBe(true)
    expect(isForbiddenHost('foo.localhost')).toBe(true)
    expect(isForbiddenHost('foo.localhost.')).toBe(true)
  })
  it('forbids private/loopback IP literals (incl. bracketed IPv6)', () => {
    expect(isForbiddenHost('127.0.0.1')).toBe(true)
    expect(isForbiddenHost('10.0.0.5')).toBe(true)
    expect(isForbiddenHost('[::1]')).toBe(true)
    expect(isForbiddenHost('')).toBe(true)
  })
  it('allows ordinary public hostnames (incl. lookalikes)', () => {
    expect(isForbiddenHost('panel.xx.com')).toBe(false)
    expect(isForbiddenHost('gw.front.com')).toBe(false)
    expect(isForbiddenHost('localhost.com')).toBe(false)
    expect(isForbiddenHost('mylocalhost')).toBe(false)
  })
})

describe('isPrivateIp', () => {
  it('flags loopback/private/link-local/metadata/ula/mapped', () => {
    for (const ip of [
      '127.0.0.1',
      '10.0.0.5',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.1.1',
      '169.254.169.254',
      '0.0.0.0',
      '100.64.0.1',
      '192.0.2.1',
      '198.18.0.1',
      '198.51.100.1',
      '203.0.113.1',
      '::1',
      '::',
      '100::1',
      '2001:db8::1',
      '2002:c0a8:0101::1',
      'fe80::1',
      'fd00::1',
      'ff02::1',
      '::ffff:127.0.0.1',
      // hex IPv4-mapped forms (SSRF bypass vectors)
      '::ffff:7f00:1', // 127.0.0.1 in hex
      '::ffff:0a00:1', // 10.0.0.1 in hex
      '::ffff:c0a8:101', // 192.168.1.1 in hex
      '::ffff:a9fe:a9fe', // 169.254.169.254 (metadata) in hex
      // full fe80::/10 link-local (not just fe80 prefix)
      'febf::1',
      // fully-expanded loopback
      '0:0:0:0:0:0:0:1'
    ]) {
      expect(isPrivateIp(ip), ip).toBe(true)
    }
  })
  it('allows public addresses', () => {
    for (const ip of ['1.1.1.1', '8.8.8.8', '93.184.216.34', '2606:4700:4700::1111']) {
      expect(isPrivateIp(ip), ip).toBe(false)
    }
  })
  it('treats invalid input as unsafe', () => {
    expect(isPrivateIp('not-an-ip')).toBe(true)
  })
  it('fails closed on malformed IPv6', () => {
    expect(isPrivateIp(':::1'), ':::1').toBe(true)
    expect(isPrivateIp('gg::1'), 'gg::1').toBe(true)
  })
})

function callLookup(
  lookup: ReturnType<typeof createGuardedLookup>,
  host: string
): Promise<{ err: unknown; address: string }> {
  return new Promise((resolve) => {
    lookup(host, {}, (err, address) => resolve({ err, address: address as string }))
  })
}

describe('createGuardedLookup', () => {
  it('returns first address when all public', async () => {
    const lookup = createGuardedLookup(async () => [{ address: '1.1.1.1', family: 4 }])
    const r = await callLookup(lookup, 'example.com')
    expect(r.err).toBeNull()
    expect(r.address).toBe('1.1.1.1')
  })
  it('rejects if any resolved address is private (rebinding)', async () => {
    const lookup = createGuardedLookup(async () => [
      { address: '1.1.1.1', family: 4 },
      { address: '127.0.0.1', family: 4 }
    ])
    const r = await callLookup(lookup, 'evil.com')
    expect(r.err).toBeTruthy()
  })
  it('rejects when nothing resolves', async () => {
    const lookup = createGuardedLookup(async () => [])
    const r = await callLookup(lookup, 'nx.example')
    expect(r.err).toBeTruthy()
  })
  // Node's autoSelectFamily (Happy Eyeballs, default in modern Node/Electron) calls the
  // custom lookup with { all: true } for dual-stack hosts and expects an ARRAY back —
  // returning a single address there throws ERR_INVALID_IP_ADDRESS ("Invalid IP: undefined").
  it('returns the full validated array when called with { all: true }', async () => {
    const lookup = createGuardedLookup(async () => [
      { address: '2606:4700::6810:e784', family: 6 },
      { address: '104.16.231.132', family: 4 }
    ])
    const r = await new Promise<{ err: unknown; addresses: unknown }>((resolve) => {
      lookup('dual.example', { all: true }, (err, addresses) => resolve({ err, addresses }))
    })
    expect(r.err).toBeNull()
    expect(r.addresses).toEqual([
      { address: '2606:4700::6810:e784', family: 6 },
      { address: '104.16.231.132', family: 4 }
    ])
  })
  it('still rejects a private address even under { all: true }', async () => {
    const lookup = createGuardedLookup(async () => [
      { address: '104.16.231.132', family: 4 },
      { address: '192.168.1.5', family: 4 }
    ])
    const r = await new Promise<{ err: unknown; addresses: unknown }>((resolve) => {
      lookup('rebind.example', { all: true }, (err, addresses) => resolve({ err, addresses }))
    })
    expect(r.err).toBeTruthy()
  })
})

describe('resolveAllPublicOrThrow', () => {
  it('returns all addresses when every one is public', async () => {
    const addrs = await resolveAllPublicOrThrow('gw.front.com', async () => [
      { address: '1.1.1.1', family: 4 },
      { address: '2606:4700::1', family: 6 }
    ])
    expect(addrs).toHaveLength(2)
  })
  it('throws CPX_GUARD_REFUSED when any address is private', async () => {
    await expect(
      resolveAllPublicOrThrow('gw.front.com', async () => [
        { address: '1.1.1.1', family: 4 },
        { address: '192.168.1.1', family: 4 }
      ])
    ).rejects.toMatchObject({ code: 'CPX_GUARD_REFUSED', phase: 'pre-send' })
  })
  it('throws an ENOTFOUND-coded error when nothing resolves', async () => {
    await expect(resolveAllPublicOrThrow('gw.front.com', async () => [])).rejects.toMatchObject({
      code: 'ENOTFOUND'
    })
  })
})

describe('R2-ISS-044: 192.0.0.0/16 is not reserved as a whole', () => {
  it('R2-ISS-062: the deprecated site-local range fec0::/10 is non-public', () => {
    expect(isPrivateIp('fec0::1')).toBe(true)
    expect(isPrivateIp('feff:ffff::1')).toBe(true) // top of the /10
    expect(isPrivateIp('fe80::1')).toBe(true) // link-local still covered
    expect(isPrivateIp('fe00::1')).toBe(false) // just outside both ranges
    expect(isForbiddenHost('[fec0::1]')).toBe(true)
  })

  it('R2-ISS-058: NAT64 — the local-use prefix 64:ff9b:1::/48 is non-public; the well-known prefix follows its embedded IPv4', () => {
    expect(isPrivateIp('64:ff9b:1::c0a8:1')).toBe(true) // 192.168.0.1 behind a local NAT64
    expect(isPrivateIp('64:ff9b:1:ffff::1')).toBe(true) // anywhere in the /48
    expect(isPrivateIp('64:ff9b::c0a8:1')).toBe(true) // well-known prefix embedding 192.168.0.1
    expect(isPrivateIp('64:ff9b::808:808')).toBe(false) // well-known prefix embedding 8.8.8.8
    expect(isPrivateIp('64:ff9c::1')).toBe(false) // adjacent public space untouched
  })

  it('rejects only the IETF /24 and TEST-NET-1, not public 192.0.x.x space', () => {
    expect(isPrivateIp('192.0.0.5')).toBe(true) // 192.0.0.0/24 IETF protocol assignments
    expect(isPrivateIp('192.0.2.1')).toBe(true) // TEST-NET-1
    expect(isPrivateIp('192.0.78.24')).toBe(false) // public (192.0.64.0/18)
    expect(isPrivateIp('192.0.1.1')).toBe(false)
  })
})
