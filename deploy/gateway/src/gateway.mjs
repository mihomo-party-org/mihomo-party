// The fixed gateway protocol: enroll / challenge / config / revoke. Mirrors the client
// v2 design §14. Handlers take (body, res, deps); deps = { db, codes, nonces, config,
// fetchSubscription }. Errors are JSON { error } with the status codes the client maps.
import { verifyPkce, verifySignature, buildSignInput, OP_CONFIG, OP_REVOKE } from './crypto.mjs'
import { sendJson, sendText } from './http.mjs'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

// §4: error JSON may carry a provider-written `message` (client sanitizes and caps it at 200
// code points). Attached only when MESSAGES_FILE defines one for that error.
function errorBody(deps, error) {
  const message = deps.messages?.[error]
  return message ? { error, message } : { error }
}

function isB64Bytes(s, n) {
  if (typeof s !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(s)) return false
  return Buffer.from(s, 'base64').length === n
}

export function enroll(body, res, deps) {
  const bound = deps.codes.consume(body?.code) // one-time, even on later failure
  if (!bound) return sendJson(res, 400, { error: 'invalid_code' })
  if (!verifyPkce(body.code_verifier, bound.code_challenge)) {
    return sendJson(res, 400, { error: 'bad_pkce' })
  }
  if (body.redirect_uri !== bound.redirect_uri || body.client_id !== bound.client_id) {
    return sendJson(res, 400, { error: 'binding_mismatch' })
  }
  if (typeof body.deviceId !== 'string' || !UUID_V4.test(body.deviceId)) {
    return sendJson(res, 400, { error: 'bad_request' })
  }
  if (!isB64Bytes(body.devicePubKey, 32)) {
    return sendJson(res, 400, { error: 'bad_request' })
  }
  const user = deps.db.getUser(bound.username)
  if (!user) return sendJson(res, 400, { error: 'invalid_code' })

  const existing = deps.db.getDevice(body.deviceId)
  const isRebind = existing && existing.username === bound.username
  if (!isRebind && deps.db.countDevices(bound.username) >= user.deviceLimit) {
    return sendJson(res, 403, errorBody(deps, 'device_limit'))
  }
  deps.db.upsertDevice({
    deviceId: body.deviceId,
    username: bound.username,
    pubKey: body.devicePubKey
  })
  sendJson(res, 200, { ok: true })
}

export function challenge(body, res, deps) {
  if (deps.config.retired) return sendJson(res, 410, errorBody(deps, 'gateway_retired'))
  const device = deps.db.getDevice(body?.deviceId)
  if (!device) return sendJson(res, 403, errorBody(deps, 'device_revoked'))
  const issued = deps.nonces.issue(device.deviceId)
  if (!issued) return sendJson(res, 429, { error: 'too_many_nonces' })
  sendJson(res, 200, issued)
}

// Validate a signed request against an already-resolved device. Returns null on success
// (and consumes the nonce), else { status, error }. Caller verifies the device exists first.
function verifySignedRequest(body, op, device, deps) {
  if (!deps.nonces.check(body?.deviceId, body?.nonceId, body?.nonce)) {
    return { status: 401, error: 'bad_nonce' }
  }
  if (typeof body.ts !== 'number' || Math.abs(Date.now() - body.ts) > deps.config.clockSkewMs) {
    return { status: 401, error: 'clock_skew' }
  }
  const input = buildSignInput(
    op,
    body.deviceId,
    body.nonceId,
    Buffer.from(body.nonce, 'base64'),
    body.ts
  )
  if (!verifySignature(device.pubKey, input, body?.sig ?? '')) {
    return { status: 403, error: 'bad_signature' }
  }
  deps.nonces.consume(body.nonceId)
  return null
}

export async function config(body, res, deps) {
  if (deps.config.retired) return sendJson(res, 410, errorBody(deps, 'gateway_retired'))
  const device = deps.db.getDevice(body?.deviceId)
  if (!device) return sendJson(res, 403, errorBody(deps, 'device_revoked'))
  const bad = verifySignedRequest(body, OP_CONFIG, device, deps)
  if (bad) return sendJson(res, bad.status, { error: bad.error })

  const user = deps.db.getUser(device.username)
  try {
    const yaml = await deps.fetchSubscription(user.subUrl, {
      timeoutMs: deps.config.subTimeoutMs,
      maxBytes: deps.config.subMaxBytes,
      ca: deps.config.originCa
    })
    // §5a: push the pre-signed discovery document in-band; keyed clients verify it themselves.
    const extra = deps.discovery ? { 'x-cpx-discovery': deps.discovery.signed } : {}
    sendText(res, 200, yaml, 'text/yaml; charset=utf-8', extra)
  } catch {
    sendJson(res, 502, { error: 'upstream' })
  }
}

export async function revoke(body, res, deps) {
  const device = deps.db.getDevice(body?.deviceId)
  if (!device) return sendJson(res, 200, { ok: true }) // idempotent: nothing to unbind
  const bad = verifySignedRequest(body, OP_REVOKE, device, deps)
  if (bad) return sendJson(res, bad.status, { error: bad.error })
  deps.db.delDevice(device.deviceId)
  sendJson(res, 200, { ok: true })
}
