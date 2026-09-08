// HTTP wiring. Caddy terminates TLS in front and reverse-proxies here over plain HTTP.
import http from 'node:http'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadConfig } from './config.mjs'
import { openDb } from './db.mjs'
import { createCodeStore } from './codes.mjs'
import { createNonceStore } from './nonces.mjs'
import { createRateLimiter } from './ratelimit.mjs'
import { fetchSubscription } from './origin.mjs'
import { readBody, parseForm, parseJson, clientIp, sendJson } from './http.mjs'
import { authorizeGet, authorizePost } from './auth.mjs'
import { enroll, challenge, config as configHandler, revoke } from './gateway.mjs'
import { parseDiscoveryEnvelope } from './discovery.mjs'

const BODY_MAX = 64 * 1024
const ENDPOINTS = {
  enroll: '/enroll',
  challenge: '/challenge',
  config: '/config',
  revoke: '/revoke'
}

export function createHandler(deps) {
  return async (req, res) => {
    try {
      const url = new URL(req.url, 'http://gateway')
      const path = url.pathname
      const method = req.method

      if (method === 'GET' && path === '/.well-known/cpx-gateway') {
        // `gateway` stays a string for old clients and MUST equal gateways[0] (client rejects
        // the whole document otherwise); both are generated from the same list.
        // With a signed document, every public field is generated from its payload (§5a).
        const gateways = deps.discovery
          ? deps.discovery.payload.gateways
          : (deps.config.gatewayOrigins ?? [deps.config.publicOrigin])
        return sendJson(res, 200, {
          spec: 'cpx-plugin/2',
          gateway: gateways[0],
          gateways,
          endpoints: ENDPOINTS,
          ...(deps.discovery ? { signed: deps.discovery.signed } : {})
        })
      }

      if (path === '/oauth/authorize') {
        if (method === 'GET') return authorizeGet(Object.fromEntries(url.searchParams), res)
        if (method === 'POST') {
          const form = parseForm(await readBody(req, BODY_MAX))
          return authorizePost(form, clientIp(req), res, deps)
        }
      }

      if (method === 'POST' && Object.values(ENDPOINTS).includes(path)) {
        const body = parseJson(await readBody(req, BODY_MAX)) ?? {}
        if (path === ENDPOINTS.enroll) return enroll(body, res, deps)
        if (path === ENDPOINTS.challenge) return challenge(body, res, deps)
        if (path === ENDPOINTS.config) return configHandler(body, res, deps)
        if (path === ENDPOINTS.revoke) return revoke(body, res, deps)
      }

      sendJson(res, 404, { error: 'not_found' })
    } catch (e) {
      if (e?.message && /too large/.test(e.message))
        return sendJson(res, 413, { error: 'too_large' })
      sendJson(res, 500, { error: 'server_error' })
    }
  }
}

const MESSAGE_KEYS = ['device_revoked', 'device_limit', 'gateway_retired']

// Only the three known keys, only strings, trimmed, non-empty. Anything else is ignored.
export function parseMessages(text) {
  let raw
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('MESSAGES_FILE is not valid JSON')
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('MESSAGES_FILE must be a JSON object')
  }
  const out = {}
  for (const k of MESSAGE_KEYS) {
    if (typeof raw[k] === 'string' && raw[k].trim()) out[k] = raw[k].trim()
  }
  return out
}

// Parse the envelope file served as well-known `signed` and the X-CPX-Discovery header. The
// signature is not verified here (the process has no key material); the client verifies. The
// payload is decoded so that `gateway` / `gateways` / `endpoints` can be generated from it, which
// keeps the top-level fields consistent with the signed document — a keyed client rejects the
// whole source when they disagree.
export function parseDiscoverySigned(text) {
  let parsed
  try {
    parsed = parseDiscoveryEnvelope(text)
  } catch (e) {
    throw new Error(`DISCOVERY_SIGNED_FILE: ${e.message}`)
  }
  for (const k of Object.keys(ENDPOINTS)) {
    if (parsed.payload.endpoints[k] !== ENDPOINTS[k]) {
      throw new Error(
        `DISCOVERY_SIGNED_FILE: endpoints.${k} must be "${ENDPOINTS[k]}" (the path this gateway serves)`
      )
    }
  }
  return parsed
}

export function buildDeps(config) {
  const originCa = config.originCaFile ? readFileSync(config.originCaFile) : undefined
  const messages = config.messagesFile
    ? parseMessages(readFileSync(config.messagesFile, 'utf-8'))
    : {}
  const discovery = config.discoverySignedFile
    ? parseDiscoverySigned(readFileSync(config.discoverySignedFile, 'utf-8'))
    : undefined
  return {
    messages,
    discovery,
    db: openDb(config.dbPath),
    codes: createCodeStore({ ttlMs: config.codeTtlMs }),
    nonces: createNonceStore({ ttlMs: config.nonceTtlMs, poolMax: config.noncePoolMax }),
    rateLimiter: createRateLimiter({ max: config.loginMax, windowMs: config.loginWindowMs }),
    fetchSubscription,
    config: { ...config, originCa }
  }
}

export function createServer(deps) {
  return http.createServer(createHandler(deps))
}

function main() {
  const config = loadConfig()
  const deps = buildDeps(config)
  createServer(deps).listen(config.port, '0.0.0.0', () => {
    console.log(
      `cpx-gateway listening on :${config.port} (gateways ${config.gatewayOrigins.join(', ')})`
    )
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
