import http from 'http'
import net from 'net'
import tls from 'tls'
import { execFileSync } from 'child_process'
import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, it, expect, afterEach } from 'vitest'
import { requestOnce, buildProxyUrl } from './http-client'

let server: http.Server | undefined
afterEach(() => server?.close())

// A throwaway self-signed cert for the TLS-over-tunnel tests (skipped when openssl is unavailable)
function selfSignedCert(): { key: string; cert: string } | undefined {
  const dir = mkdtempSync(join(tmpdir(), 'cpx-tls-'))
  try {
    execFileSync(
      'openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'ec',
        '-pkeyopt',
        'ec_paramgen_curve:prime256v1',
        '-nodes',
        '-keyout',
        join(dir, 'key.pem'),
        '-out',
        join(dir, 'cert.pem'),
        '-days',
        '1',
        '-subj',
        '/CN=target.invalid'
      ],
      { stdio: 'ignore' }
    )
    return {
      key: readFileSync(join(dir, 'key.pem'), 'utf8'),
      cert: readFileSync(join(dir, 'cert.pem'), 'utf8')
    }
  } catch {
    return undefined
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
const TLS_FIXTURE = selfSignedCert()

async function waitFor(cond: () => boolean, ms = 1000): Promise<void> {
  const until = Date.now() + ms
  while (!cond() && Date.now() < until) await new Promise((r) => setTimeout(r, 10))
}

function start(handler: http.RequestListener): Promise<string> {
  return new Promise((resolve) => {
    server = http.createServer(handler)
    server.listen(0, '127.0.0.1', () => {
      const addr = server!.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      resolve(`http://127.0.0.1:${port}`)
    })
  })
}

describe('requestOnce', () => {
  it('performs a GET and returns status + body', async () => {
    const url = await start((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end('{"ok":true}')
    })
    const r = await requestOnce(url + '/x', { method: 'GET', timeout: 5000, maxBytes: 1024 })
    expect(r.status).toBe(200)
    expect(r.body).toBe('{"ok":true}')
  })

  it('sends a POST body', async () => {
    const url = await start((req, res) => {
      const chunks: Buffer[] = []
      req.on('data', (c) => chunks.push(c))
      req.on('end', () => {
        res.writeHead(200)
        res.end(Buffer.concat(chunks).toString('utf-8'))
      })
    })
    const r = await requestOnce(url + '/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"email":"a"}',
      timeout: 5000,
      maxBytes: 1024
    })
    expect(r.body).toBe('{"email":"a"}')
  })

  it('rejects redirects instead of following', async () => {
    const url = await start((_req, res) => {
      res.writeHead(302, { location: 'https://evil.example' })
      res.end()
    })
    await expect(
      requestOnce(url + '/r', { method: 'GET', timeout: 5000, maxBytes: 1024 })
    ).rejects.toMatchObject({
      message: expect.stringMatching(/redirect/i),
      code: 'CPX_REDIRECT_REFUSED',
      phase: 'possibly-sent'
    })
  })

  it('rejects oversized responses', async () => {
    const url = await start((_req, res) => {
      res.writeHead(200)
      res.end('x'.repeat(5000))
    })
    await expect(
      requestOnce(url + '/big', { method: 'GET', timeout: 5000, maxBytes: 1000 })
    ).rejects.toMatchObject({
      message: expect.stringMatching(/too large/i),
      code: 'CPX_RESPONSE_TOO_LARGE',
      phase: 'possibly-sent'
    })
  })

  it('rejects forbidden headers', async () => {
    const url = await start((_req, res) => res.end('ok'))
    await expect(
      requestOnce(url + '/h', {
        method: 'GET',
        headers: { Host: 'evil' },
        timeout: 5000,
        maxBytes: 1024
      })
    ).rejects.toThrow(/forbidden/i)
  })

  it('rejects too many request headers', async () => {
    const url = await start((_req, res) => res.end('ok'))
    await expect(
      requestOnce(url + '/h', {
        method: 'GET',
        headers: Object.fromEntries(Array.from({ length: 33 }, (_, i) => [`X-Test-${i}`, 'v'])),
        timeout: 5000,
        maxBytes: 1024
      })
    ).rejects.toThrow(/headers/i)
  })

  it('rejects oversized request headers', async () => {
    const url = await start((_req, res) => res.end('ok'))
    await expect(
      requestOnce(url + '/h', {
        method: 'GET',
        headers: { 'X-Large': 'x'.repeat(16 * 1024 + 1) },
        timeout: 5000,
        maxBytes: 1024
      })
    ).rejects.toThrow(/headers/i)
  })

  it('times out slow responses', async () => {
    const url = await start((_req, res) => {
      setTimeout(() => res.end('late'), 200)
    })
    await expect(
      requestOnce(url + '/slow', { method: 'GET', timeout: 50, maxBytes: 1024 })
    ).rejects.toMatchObject({ message: expect.stringMatching(/timed out/i), code: 'CPX_TIMEOUT' })
  })

  it('aborts on the op signal and maps the abort to CPX_TIMEOUT', async () => {
    const url = await start((_req, res) => {
      setTimeout(() => res.end('late'), 500)
    })
    const ac = new AbortController()
    setTimeout(() => ac.abort(new Error('budget exhausted')), 20)
    await expect(
      requestOnce(url + '/hang', {
        method: 'GET',
        timeout: 5000,
        maxBytes: 1024,
        signal: ac.signal
      })
    ).rejects.toMatchObject({ code: 'CPX_TIMEOUT' })
  })

  it('routes the request through the configured proxy when proxy is set', async () => {
    const seen: string[] = []
    const proxy = http.createServer((req, res) => {
      seen.push(req.url ?? '')
      res.writeHead(200, { 'content-type': 'text/plain' })
      res.end('via-proxy')
    })
    await new Promise<void>((r) => proxy.listen(0, '127.0.0.1', () => r()))
    const proxyPort = (proxy.address() as { port: number }).port
    try {
      // target.invalid 永不可解析：没走代理就连不上，证明请求确实经由代理发出
      const res = await requestOnce('http://target.invalid/getSub', {
        method: 'GET',
        timeout: 5000,
        maxBytes: 4096,
        proxy: { host: '127.0.0.1', port: proxyPort }
      })
      expect(res.body).toBe('via-proxy')
      expect(seen).toContain('http://target.invalid/getSub')
    } finally {
      proxy.close()
    }
  })

  it('marks a connection refusal as pre-send with its errno code', async () => {
    const probe = http.createServer()
    await new Promise<void>((r) => probe.listen(0, '127.0.0.1', () => r()))
    const port = (probe.address() as { port: number }).port
    await new Promise<void>((r) => probe.close(() => r()))
    await expect(
      requestOnce(`http://127.0.0.1:${port}/x`, { method: 'GET', timeout: 5000, maxBytes: 1024 })
    ).rejects.toMatchObject({ code: 'ECONNREFUSED', phase: 'pre-send' })
  })

  it('marks a reset after the request was sent as possibly-sent', async () => {
    const url = await start((req) => {
      req.socket.destroy()
    })
    await expect(
      requestOnce(url + '/reset', { method: 'GET', timeout: 5000, maxBytes: 1024 })
    ).rejects.toMatchObject({ code: 'ECONNRESET', phase: 'possibly-sent' })
  })

  it('aborts a lookup that never returns via the signal and maps it to CPX_TIMEOUT', async () => {
    const ac = new AbortController()
    setTimeout(() => ac.abort(new Error('budget exhausted')), 30)
    await expect(
      requestOnce('http://never.example/x', {
        method: 'GET',
        timeout: 5000,
        maxBytes: 1024,
        signal: ac.signal,
        lookup: () => {
          /* never calls back */
        }
      })
    ).rejects.toMatchObject({ code: 'CPX_TIMEOUT', phase: 'pre-send' })
  })

  it('R2-ISS-007: a proxy that accepts the connection but never answers CONNECT is cut off by the signal', async () => {
    const sockets: net.Socket[] = []
    let closed = 0
    const proxy = net.createServer((socket) => {
      sockets.push(socket) // accept, never answer the CONNECT
      socket.resume() // a paused server socket never reads, so it would never observe the client's FIN
      socket.on('close', () => closed++)
    })
    await new Promise<void>((r) => proxy.listen(0, '127.0.0.1', () => r()))
    const port = (proxy.address() as { port: number }).port
    const ac = new AbortController()
    setTimeout(() => ac.abort(new Error('budget exhausted')), 50)
    const started = Date.now()
    try {
      await expect(
        requestOnce('https://target.invalid/x', {
          method: 'GET',
          timeout: 5000,
          maxBytes: 1024,
          signal: ac.signal,
          proxy: { host: '127.0.0.1', port }
        })
      ).rejects.toMatchObject({ code: 'CPX_TIMEOUT' })
      expect(Date.now() - started).toBeLessThan(2000)
      // BL-004 (ISS-007 residual): the hung CONNECT connection is torn down by the abort, not left to the proxy
      expect(sockets).toHaveLength(1)
      await waitFor(() => closed === sockets.length)
      expect(closed).toBe(1)
    } finally {
      proxy.close()
      sockets.forEach((s) => s.destroy())
    }
  })

  it('R2-ISS-054: an invalid proxy port (mixed-port disabled → 0) is refused before any connection', async () => {
    for (const port of [0, -1, 70000, 1.5, NaN]) {
      const started = Date.now()
      await expect(
        requestOnce('https://target.invalid/x', {
          method: 'GET',
          timeout: 5000,
          maxBytes: 1024,
          proxy: { host: '127.0.0.1', port, auth: { user: 'u', pass: 'p' } }
        })
      ).rejects.toMatchObject({ code: 'CPX_PROXY_CONNECT_FAILED', phase: 'pre-send' })
      expect(Date.now() - started).toBeLessThan(500)
    }
  })

  it('BL-004: the CONNECT request carries the target authority and the proxy credentials', async () => {
    const sockets: net.Socket[] = []
    let head = ''
    const proxy = net.createServer((socket) => {
      sockets.push(socket)
      socket.once('data', (d) => {
        head = d.toString('latin1')
        socket.end('HTTP/1.1 407 Proxy Authentication Required\r\nContent-Length: 0\r\n\r\n')
      })
    })
    await new Promise<void>((r) => proxy.listen(0, '127.0.0.1', () => r()))
    const port = (proxy.address() as { port: number }).port
    try {
      await expect(
        requestOnce('https://target.invalid:8443/x', {
          method: 'GET',
          timeout: 5000,
          maxBytes: 1024,
          proxy: { host: '127.0.0.1', port, auth: { user: 'us@er', pass: 'p:a/ss' } }
        })
      ).rejects.toMatchObject({ code: 'CPX_PROXY_CONNECT_FAILED', phase: 'pre-send' })
      expect(head.startsWith('CONNECT target.invalid:8443 HTTP/1.1\r\n')).toBe(true)
      expect(head).toContain('\r\nHost: target.invalid:8443\r\n')
      expect(head).toContain(
        `\r\nProxy-Authorization: Basic ${Buffer.from('us@er:p:a/ss').toString('base64')}\r\n`
      )
    } finally {
      proxy.close()
      sockets.forEach((s) => s.destroy())
    }
  })

  it.skipIf(!TLS_FIXTURE)(
    'R2-ISS-059: a request over the tunnel carries the right Host (no :80) and completes end to end',
    async () => {
      const sockets: net.Socket[] = []
      const hosts: string[] = []
      const proxy = net.createServer((socket) => {
        sockets.push(socket)
        socket.once('data', () => {
          socket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
          // from here on the proxy plays the target: a TLS server on the same connection
          const secure = new tls.TLSSocket(socket, { isServer: true, ...TLS_FIXTURE })
          secure.on('error', () => undefined)
          secure.once('data', (d) => {
            const m = /\r\nHost: ([^\r]+)\r\n/i.exec(d.toString('latin1'))
            hosts.push(m?.[1] ?? '')
            secure.end('HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok')
          })
        })
      })
      await new Promise<void>((r) => proxy.listen(0, '127.0.0.1', () => r()))
      const port = (proxy.address() as { port: number }).port
      const saved = process.env.NODE_TLS_REJECT_UNAUTHORIZED
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0' // self-signed target; verification is not under test here
      try {
        const res = await requestOnce('https://target.invalid/x', {
          method: 'GET',
          timeout: 5000,
          maxBytes: 1024,
          proxy: { host: '127.0.0.1', port }
        })
        expect(res.status).toBe(200)
        expect(res.body).toBe('ok')
        const res2 = await requestOnce('https://target.invalid:8443/x', {
          method: 'GET',
          timeout: 5000,
          maxBytes: 1024,
          proxy: { host: '127.0.0.1', port }
        })
        expect(res2.body).toBe('ok')
        expect(hosts).toEqual(['target.invalid', 'target.invalid:8443'])
      } finally {
        if (saved === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED
        else process.env.NODE_TLS_REJECT_UNAUTHORIZED = saved
        proxy.close()
        sockets.forEach((s) => s.destroy())
      }
    }
  )

  it('BL-004: after CONNECT 200 the client starts TLS on the tunnel with the target name as SNI', async () => {
    const sockets: net.Socket[] = []
    let hello: Buffer | undefined
    const proxy = net.createServer((socket) => {
      sockets.push(socket)
      socket.once('data', () => {
        socket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
        socket.once('data', (d) => {
          hello = d
          socket.destroy()
        })
      })
    })
    await new Promise<void>((r) => proxy.listen(0, '127.0.0.1', () => r()))
    const port = (proxy.address() as { port: number }).port
    try {
      const err = await requestOnce('https://target.invalid/x', {
        method: 'GET',
        timeout: 5000,
        maxBytes: 1024,
        proxy: { host: '127.0.0.1', port }
      }).then(
        () => undefined,
        (e: unknown) => e as { phase?: string }
      )
      expect(err?.phase).toBe('pre-send')
      // TLS handshake record (0x16) carrying a ClientHello whose SNI is the target hostname
      expect(hello?.[0]).toBe(0x16)
      expect(hello?.includes('target.invalid')).toBe(true)
    } finally {
      proxy.close()
      sockets.forEach((s) => s.destroy())
    }
  })

  it('R2-ISS-022: a slow-drip response is cut off by the wall-clock timeout, not the idle timeout', async () => {
    const sockets: net.Socket[] = []
    const drip = net.createServer((socket) => {
      sockets.push(socket)
      socket.write('HTTP/1.1 200 OK\r\n')
      const t = setInterval(() => socket.write('X-Drip: 1\r\n'), 40) // never finishes the headers
      socket.on('close', () => clearInterval(t))
    })
    await new Promise<void>((r) => drip.listen(0, '127.0.0.1', () => r()))
    const port = (drip.address() as { port: number }).port
    const started = Date.now()
    try {
      await expect(
        requestOnce(`http://127.0.0.1:${port}/x`, { method: 'GET', timeout: 300, maxBytes: 1024 })
      ).rejects.toMatchObject({ code: 'CPX_TIMEOUT' })
      expect(Date.now() - started).toBeLessThan(1500)
    } finally {
      drip.close()
      sockets.forEach((s) => s.destroy())
    }
  })

  it('R2-ISS-039: a proxy that rejects CONNECT is a pre-send connection failure, not a target response', async () => {
    const sockets: net.Socket[] = []
    const proxy = net.createServer((socket) => {
      sockets.push(socket)
      socket.once('data', () => {
        socket.end('HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\n\r\n')
      })
    })
    await new Promise<void>((r) => proxy.listen(0, '127.0.0.1', () => r()))
    const port = (proxy.address() as { port: number }).port
    try {
      const err = await requestOnce('https://target.invalid/x', {
        method: 'GET',
        timeout: 5000,
        maxBytes: 1024,
        proxy: { host: '127.0.0.1', port }
      }).then(
        () => undefined,
        (e: unknown) => e as { code?: string; phase?: string; status?: number }
      )
      expect(err).toMatchObject({ code: 'CPX_PROXY_CONNECT_FAILED', phase: 'pre-send' })
      expect(err?.status).toBeUndefined()
    } finally {
      proxy.close()
      sockets.forEach((s) => s.destroy())
    }
  })

  it('R2-ISS-043: a proxy that closes before answering CONNECT is a pre-send tunnel failure', async () => {
    const sockets: net.Socket[] = []
    const proxy = net.createServer((socket) => {
      sockets.push(socket)
      socket.once('data', () => socket.end()) // FIN without any CONNECT response
    })
    await new Promise<void>((r) => proxy.listen(0, '127.0.0.1', () => r()))
    const port = (proxy.address() as { port: number }).port
    try {
      await expect(
        requestOnce('https://target.invalid/x', {
          method: 'GET',
          timeout: 5000,
          maxBytes: 1024,
          proxy: { host: '127.0.0.1', port }
        })
      ).rejects.toMatchObject({ code: 'CPX_PROXY_CONNECT_FAILED', phase: 'pre-send' })
    } finally {
      proxy.close()
      sockets.forEach((s) => s.destroy())
    }
  })

  it('R2-ISS-042: a TLS handshake failure over a proxy tunnel is pre-send (phase not flipped before secureConnect)', async () => {
    const sockets: net.Socket[] = []
    const proxy = net.createServer((socket) => {
      sockets.push(socket)
      socket.once('data', () => {
        socket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
        // answer the ClientHello with non-TLS bytes → handshake fails before secureConnect
        setTimeout(() => socket.write('not a tls server\n'), 15)
      })
    })
    await new Promise<void>((r) => proxy.listen(0, '127.0.0.1', () => r()))
    const port = (proxy.address() as { port: number }).port
    try {
      const err = await requestOnce('https://target.invalid/x', {
        method: 'GET',
        timeout: 5000,
        maxBytes: 1024,
        proxy: { host: '127.0.0.1', port }
      }).then(
        () => undefined,
        (e: unknown) => e as { phase?: string; code?: string }
      )
      // the handshake never completed → the request was never sent → pre-send (enroll may retry)
      expect(err?.phase).toBe('pre-send')
    } finally {
      proxy.close()
      sockets.forEach((s) => s.destroy())
    }
  })

  it('R2-ISS-035: every direct request runs the guarded lookup — no connection reuse across requests', async () => {
    const url = new URL(
      await start((_req, res) => {
        res.writeHead(200)
        res.end('ok')
      })
    )
    let lookups = 0
    const lookup = ((hostname: string, options: unknown, callback?: unknown): void => {
      lookups++
      const cb = (typeof options === 'function' ? options : callback) as (
        err: null,
        address: string | { address: string; family: number }[],
        family?: number
      ) => void
      const all =
        typeof options === 'object' && options !== null && (options as { all?: boolean }).all
      if (all) cb(null, [{ address: '127.0.0.1', family: 4 }])
      else cb(null, '127.0.0.1', 4)
    }) as unknown as import('net').LookupFunction
    const target = `http://guarded.invalid:${url.port}/x`
    await requestOnce(target, { method: 'GET', timeout: 5000, maxBytes: 1024, lookup })
    await requestOnce(target, { method: 'GET', timeout: 5000, maxBytes: 1024, lookup })
    expect(lookups).toBe(2)
  })

  it('R2-ISS-030: a synchronous request-construction failure rejects cleanly and never fires the timer', async () => {
    // a negative timeout makes http.request throw before any socket exists
    await expect(
      requestOnce('http://127.0.0.1:1/x', { method: 'GET', timeout: -1000, maxBytes: 1024 })
    ).rejects.toMatchObject({ code: 'ERR_OUT_OF_RANGE', phase: 'pre-send' })
    // the wall-clock timer (scheduled for "-1000ms" → immediately) must have been cleared: an
    // uncaught ReferenceError here would fail the test run
    await new Promise((r) => setTimeout(r, 20))
  })

  it('R2-ISS-009: a failure after the response headers carries the status (503 then reset)', async () => {
    const url = await start((_req, res) => {
      // declare more body than is sent so the client has parsed the headers and is waiting on the
      // body when the socket is reset
      res.writeHead(503, { 'content-length': '100' })
      res.write('partial')
      setTimeout(() => res.socket?.destroy(), 50)
    })
    await expect(
      requestOnce(url + '/x', { method: 'GET', timeout: 5000, maxBytes: 1024 })
    ).rejects.toMatchObject({ status: 503, phase: 'possibly-sent' })
  })

  it('R2-ISS-009: redirect refusal and oversize responses carry the status too', async () => {
    const url = await start((req, res) => {
      if (req.url === '/r') {
        res.writeHead(302, { location: '/x' })
        res.end()
      } else {
        res.writeHead(200)
        res.end('x'.repeat(100))
      }
    })
    await expect(
      requestOnce(url + '/r', { method: 'GET', timeout: 5000, maxBytes: 1024 })
    ).rejects.toMatchObject({ code: 'CPX_REDIRECT_REFUSED', status: 302 })
    await expect(
      requestOnce(url + '/big', { method: 'GET', timeout: 5000, maxBytes: 10 })
    ).rejects.toMatchObject({ code: 'CPX_RESPONSE_TOO_LARGE', status: 200 })
  })

  it('sends URL-encoded proxy credentials (containing @, : and /) as Proxy-Authorization', async () => {
    const seen: string[] = []
    const proxy = http.createServer((req, res) => {
      seen.push(req.headers['proxy-authorization'] ?? '')
      res.writeHead(200)
      res.end('ok')
    })
    await new Promise<void>((r) => proxy.listen(0, '127.0.0.1', () => r()))
    const proxyPort = (proxy.address() as { port: number }).port
    try {
      const res = await requestOnce('http://target.invalid/x', {
        method: 'GET',
        timeout: 5000,
        maxBytes: 4096,
        proxy: { host: '127.0.0.1', port: proxyPort, auth: { user: 'us@er', pass: 'p:a/ss' } }
      })
      expect(res.body).toBe('ok')
      expect(seen).toEqual([`Basic ${Buffer.from('us@er:p:a/ss').toString('base64')}`])
    } finally {
      proxy.close()
    }
  })

  it('buildProxyUrl encodes credentials through the URL object instead of string concatenation', () => {
    const u = new URL(
      buildProxyUrl({ host: '127.0.0.1', port: 1, auth: { user: 'us@er', pass: 'p:a/ss' } })
    )
    expect(u.username).toBe('us%40er')
    expect(u.password).toBe('p%3Aa%2Fss')
    expect(buildProxyUrl({ host: '::1', port: 2 })).toBe('http://[::1]:2/')
  })
})
