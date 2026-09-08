import http from 'http'
import https from 'https'
import { isIP, type LookupFunction, type Socket } from 'net'
import tls, { type TLSSocket } from 'tls'
import { HttpProxyAgent } from 'http-proxy-agent'
import {
  CPX_PROXY_CONNECT_FAILED,
  CPX_REDIRECT_REFUSED,
  CPX_RESPONSE_TOO_LARGE,
  CPX_TIMEOUT,
  codedError,
  codeOf,
  type CodedError,
  type ErrorPhase
} from './errors'

export interface PluginProxy {
  host: string
  port: number
  auth?: { user: string; pass: string }
}

export interface PluginRequestOptions {
  method: 'GET' | 'POST'
  headers?: Record<string, string>
  body?: string
  timeout: number
  maxBytes: number
  lookup?: LookupFunction
  // 走代理时由代理负责解析/连接目标，本地 SSRF guarded lookup 不再适用（安全保证降级）
  proxy?: PluginProxy
  // op 预算（§0.4）：中止后与平台 ETIMEDOUT 一起映射为 CPX_TIMEOUT
  signal?: AbortSignal
}

export interface PluginResponse {
  status: number
  headers: http.IncomingHttpHeaders
  body: string
}

const FORBIDDEN_HEADERS = new Set(['host', 'content-length', 'connection', 'transfer-encoding'])
const MAX_HEADERS = 32
const MAX_HEADER_NAME_LEN = 128
const MAX_HEADER_VALUE_LEN = 4096
const MAX_HEADER_BYTES = 16 * 1024

function validateHeaders(input: Record<string, string>): Record<string, string> {
  const entries = Object.entries(input)
  if (entries.length > MAX_HEADERS) throw new Error('Request headers too large')

  const headers: Record<string, string> = {}
  let total = 0
  for (const [k, v] of entries) {
    if (FORBIDDEN_HEADERS.has(k.toLowerCase())) {
      throw new Error(`Forbidden header: ${k}`)
    }
    const nameBytes = Buffer.byteLength(k, 'utf-8')
    const valueBytes = Buffer.byteLength(v, 'utf-8')
    if (nameBytes > MAX_HEADER_NAME_LEN || valueBytes > MAX_HEADER_VALUE_LEN) {
      throw new Error('Request headers too large')
    }
    total += nameBytes + valueBytes
    headers[k] = v
  }
  if (total > MAX_HEADER_BYTES) throw new Error('Request headers too large')
  return headers
}

// 代理 URL 用 URL 对象设置 username/password（自动百分号编码），不拼字符串；两个 agent 都会解码后
// 生成 Proxy-Authorization。
export function buildProxyUrl(proxy: PluginProxy): string {
  const host = proxy.host.includes(':') ? `[${proxy.host}]` : proxy.host
  const u = new URL(`http://${host}:${proxy.port}`)
  if (proxy.auth) {
    u.username = proxy.auth.user
    u.password = proxy.auth.pass
  }
  return u.toString()
}

function isValidPort(port: unknown): port is number {
  return Number.isInteger(port) && (port as number) >= 1 && (port as number) <= 65535
}

function stripBrackets(hostname: string): string {
  return hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname
}

interface ProxyTunnel {
  // CONNECT 请求本身：预算中止 / 墙钟超时时 destroy 它，连到代理的 socket 随之关闭
  req: http.ClientRequest
  // 隧道建立后包好 TLS 的 socket（握手尚未开始，交给真正的请求后再进行）
  socket: Promise<TLSSocket>
}

// 经代理的 https 不用 https-proxy-agent 而自己建隧道（ISS-007 残余）：agent-base 在 CONNECT 完成前不把连接交给
// 请求，预算中止时 req.destroy() 够不到它，挂起的 CONNECT 连接会残留到代理自己关闭为止。这里 CONNECT 本身是
// 一个 agent=false 的 http.ClientRequest——连到代理的 socket 在创建时同步分配，destroy 立即关闭它；隧道建立后
// 用 tls.connect 包一层，经 createConnection 交给真正的请求。
function openProxyTunnel(
  proxy: URL,
  target: URL,
  opts: { signal?: AbortSignal; timeout: number }
): ProxyTunnel {
  const targetHost = stripBrackets(target.hostname)
  const targetPort = Number(target.port) || 443
  const headers: Record<string, string> = { Host: `${target.hostname}:${targetPort}` }
  if (proxy.username || proxy.password) {
    const cred = `${decodeURIComponent(proxy.username)}:${decodeURIComponent(proxy.password)}`
    headers['Proxy-Authorization'] = `Basic ${Buffer.from(cred).toString('base64')}`
  }
  const tunnelFailed = (detail: string): CodedError =>
    codedError(`Proxy tunnel failed (${detail})`, CPX_PROXY_CONNECT_FAILED, 'pre-send')
  const req = http.request({
    host: stripBrackets(proxy.hostname),
    // 只有 URL 省略端口时才取默认的 80；显式的 0 等非法端口原样交给 connect 失败，不得改写成别的端口
    port: proxy.port === '' ? 80 : Number(proxy.port),
    method: 'CONNECT',
    path: `${target.hostname}:${targetPort}`,
    headers,
    agent: false,
    timeout: opts.timeout,
    signal: opts.signal
  })
  const socket = new Promise<TLSSocket>((resolve, reject) => {
    req.once('connect', (res, raw: Socket, head: Buffer) => {
      // 代理对 CONNECT 的非 2xx 响应（Node 对 CONNECT 一律以 'connect' 事件交付）：目标根本没有收到请求
      if (res.statusCode !== 200) {
        raw.destroy()
        reject(tunnelFailed(`status ${res.statusCode ?? 0}`))
        return
      }
      if (head.length > 0) raw.unshift(head)
      resolve(
        tls.connect({
          socket: raw,
          host: targetHost,
          servername: isIP(targetHost) ? undefined : targetHost
        })
      )
    })
    req.once('response', (res) => {
      res.destroy()
      reject(tunnelFailed(`status ${res.statusCode ?? 0}`))
    })
    req.once('timeout', () => req.destroy(codedError('Request timed out', CPX_TIMEOUT)))
    // 隧道阶段的任何连接错误（拒绝 / 复位 / 未应答即 FIN）都是隧道失败（pre-send，可回退直连）；
    // 超时与预算中止保留 CPX_TIMEOUT 语义
    req.once('error', (e) => reject(isTimeoutLike(e) ? e : tunnelFailed(e.message)))
  })
  req.end()
  return { req, socket }
}

function isTimeoutLike(e: unknown): boolean {
  const code = codeOf(e)
  if (code === CPX_TIMEOUT || code === 'ETIMEDOUT' || code === 'ABORT_ERR') return true
  return e instanceof Error && e.name === 'AbortError'
}

// 超时、预算中止（AbortError）与平台 ETIMEDOUT 统一映射为 CPX_TIMEOUT；其余错误原样透传。
// 所有错误都带 phase（§0.3）。
function normalizeError(e: unknown, phase: ErrorPhase): unknown {
  let err: unknown = e
  if (codeOf(e) !== CPX_TIMEOUT && isTimeoutLike(e)) {
    err = codedError('Request timed out', CPX_TIMEOUT)
  }
  if (typeof err === 'object' && err !== null && !(err as CodedError).phase) {
    ;(err as CodedError).phase = phase
  }
  return err
}

// TLS socket 以 secureConnect 为准，明文 socket 以 connect 为准；复用的已连接 socket 立即视为已发送。
function watchPhase(socket: Socket, flip: () => void): void {
  const tlsSocket = socket as TLSSocket
  if (tlsSocket.encrypted) {
    // TLS：握手完成前不得翻 possibly-sent（否则 enroll 的 pre-send-only 会拒绝本可回退的握手期失败）。
    // getProtocol() 在握手完成前就可能返回真实版本，不可靠；authorized / authorizationError 只有在握手
    // 结束后才被写入，据此判断“握手已完成”。否则等 secureConnect（现在直连与代理都每请求新建连接，
    // 不存在复用的已握手 socket，secureConnect 必然在此后触发）。
    const handshakeDone =
      !socket.connecting && (tlsSocket.authorized === true || tlsSocket.authorizationError != null)
    if (handshakeDone) flip()
    else socket.once('secureConnect', flip)
    return
  }
  if (!socket.connecting) flip()
  else socket.once('connect', flip)
}

export function requestOnce(urlStr: string, opts: PluginRequestOptions): Promise<PluginResponse> {
  return new Promise((resolve, reject) => {
    let url: URL
    try {
      url = new URL(urlStr)
    } catch {
      reject(codedError('Invalid URL', 'CPX_INVALID_URL', 'pre-send'))
      return
    }
    const mod = url.protocol === 'https:' ? https : url.protocol === 'http:' ? http : null
    if (!mod) {
      reject(codedError(`Unsupported protocol: ${url.protocol}`, 'CPX_INVALID_URL', 'pre-send'))
      return
    }
    const client: typeof http | typeof https = mod
    let headers: Record<string, string>
    try {
      headers = validateHeaders(opts.headers ?? {})
    } catch (e) {
      reject(normalizeError(e, 'pre-send'))
      return
    }
    if (opts.body !== undefined) headers['Content-Length'] = String(Buffer.byteLength(opts.body))
    // 预算已耗尽：不创建请求
    if (opts.signal?.aborted) {
      reject(codedError('Request timed out', CPX_TIMEOUT, 'pre-send'))
      return
    }
    // 非法的代理端口（如核心关闭了混合端口时的 0）：按隧道不可用拒绝，绝不改写成别的端口去连——
    // 那会把请求和代理凭据送给无关的本地服务。所有调用方（含 .cpx 下载）在这里统一把关
    if (opts.proxy && !isValidPort(opts.proxy.port)) {
      reject(
        codedError(
          `Invalid proxy port: ${String(opts.proxy.port)}`,
          CPX_PROXY_CONNECT_FAILED,
          'pre-send'
        )
      )
      return
    }

    // 代理模式：连接打到本地代理，目标由代理解析；不再注入 guarded lookup。经代理的 http 用 HttpProxyAgent
    // （连接在创建时同步分配，可被 destroy）；经代理的 https 自建 CONNECT 隧道（openProxyTunnel），请求不带 agent，
    // 用 createConnection 接收隧道 socket。
    // 直连模式：agent=false，每个请求新建连接、不复用进程级 globalAgent 的 keep-alive 池（Node ≥ 19 默认开启）——
    // 池里可能有主进程其它调用方建立的、指向私网地址的同 host:port socket，复用会绕过 guarded lookup，
    // 而 lookup 只在建立新连接时执行。
    const proxyUrl = opts.proxy ? buildProxyUrl(opts.proxy) : undefined
    const tunneled = proxyUrl !== undefined && url.protocol === 'https:'
    const agent: http.Agent | false | undefined = proxyUrl
      ? tunneled
        ? undefined
        : new HttpProxyAgent(proxyUrl)
      : false

    let phase: ErrorPhase = 'pre-send'
    // 已收到响应头后记录的状态码：之后的任何失败都带上它（§1.3 / §2.4 的“服务器已到达”）
    let responseStatus: number | undefined
    let settled = false
    let req: http.ClientRequest | undefined
    let connectReq: http.ClientRequest | undefined
    // 唯一的结束入口：清理墙钟定时器与 abort 监听；之后到达的任何事件都被忽略。
    // （wallClock 在下方创建；这里只在异步回调里读取，首次调用时已存在。）
    const finish = (fn: () => void): void => {
      if (settled) return
      settled = true
      clearTimeout(wallClock)
      opts.signal?.removeEventListener('abort', onAbort)
      fn()
    }
    const fail = (e: unknown): void =>
      finish(() => {
        let err = normalizeError(e, phase) as CodedError
        // 经代理、请求尚未发出（phase 仍为 pre-send）且尚无响应时的无 code 错误来自隧道阶段（http 代理 agent
        // 的连接阶段、https 隧道内的 TLS 阶段）：目标没有收到请求，按隧道建立失败处理，让路由层回退直连。
        // 已翻到 possibly-sent 之后的错误不能再降级为 pre-send——否则 pre-send-only 策略会重试可能已送达的请求
        if (proxyUrl && phase === 'pre-send' && responseStatus === undefined && !err.code) {
          err = codedError(err.message, CPX_PROXY_CONNECT_FAILED, 'pre-send')
        }
        if (responseStatus !== undefined && err.status === undefined) err.status = responseStatus
        reject(err)
      })
    // 预算中止 / 墙钟超时：结束 Promise，并销毁已经存在的连接——真正的请求，或仍在等代理应答的 CONNECT 请求
    // （它的 socket 在创建时就已分配，destroy 立即关闭它）。墙钟定时器用的是同一个 opts.timeout：Node 自身的
    // timeout 是 socket 空闲超时，对持续滴流的对端不生效。
    const onTimeout = (): void => {
      const err = codedError('Request timed out', CPX_TIMEOUT)
      connectReq?.destroy(err)
      req?.destroy(err)
      fail(err)
    }
    const onAbort = (): void => onTimeout()
    opts.signal?.addEventListener('abort', onAbort, { once: true })
    const wallClock = setTimeout(onTimeout, opts.timeout)

    if (tunneled) {
      const tunnel = openProxyTunnel(new URL(proxyUrl), url, {
        signal: opts.signal,
        timeout: opts.timeout
      })
      connectReq = tunnel.req
      tunnel.socket.then((socket) => {
        // 隧道建成时请求已经结束（预算中止 / 超时）：不再发请求，关掉刚建好的连接
        if (settled) {
          socket.destroy()
          return
        }
        start(() => socket)
      }, fail)
    } else {
      start()
    }

    // 请求构造可能同步抛错（例如非法的 timeout 选项）：必须经同一个结束入口清理定时器与监听，
    // 否则定时器随后会访问从未初始化的 req。
    function start(createConnection?: () => Socket): void {
      try {
        req = createRequest(createConnection)
      } catch (e) {
        fail(e)
        return
      }
      req.on('socket', (socket: Socket) => {
        watchPhase(socket, () => {
          phase = 'possibly-sent'
        })
      })
      req.on('timeout', () => req?.destroy(codedError('Request timed out', CPX_TIMEOUT)))
      req.on('error', fail)
      if (opts.body !== undefined) req.write(opts.body)
      req.end()
    }

    function createRequest(createConnection?: () => Socket): http.ClientRequest {
      return client.request(
        url,
        {
          method: opts.method,
          headers,
          agent,
          createConnection,
          // 隧道内的请求没有 agent，Node 拿不到协议默认端口，会把 Host 算成 host:80——显式给出
          defaultPort: url.protocol === 'https:' ? 443 : 80,
          lookup: proxyUrl ? undefined : opts.lookup,
          timeout: opts.timeout,
          signal: opts.signal
        },
        onResponse
      )
    }

    function onResponse(res: http.IncomingMessage): void {
      phase = 'possibly-sent'
      const status = res.statusCode ?? 0
      responseStatus = status
      if (status >= 300 && status < 400) {
        res.destroy()
        fail(codedError(`Refusing to follow redirect (status ${status})`, CPX_REDIRECT_REFUSED))
        return
      }
      const chunks: Buffer[] = []
      let size = 0
      res.on('data', (c: Buffer) => {
        size += c.length
        if (size > opts.maxBytes) {
          res.destroy()
          fail(codedError('Response too large', CPX_RESPONSE_TOO_LARGE))
          return
        }
        chunks.push(c)
      })
      res.on('end', () =>
        finish(() =>
          resolve({ status, headers: res.headers, body: Buffer.concat(chunks).toString('utf-8') })
        )
      )
      res.on('error', fail)
    }
  })
}
