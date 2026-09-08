// Small HTTP helpers: bounded body read, body parsing, client IP, and response writers.
// TLS is terminated by Caddy in front, so the gateway speaks plain HTTP internally.

export async function readBody(req, maxBytes) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > maxBytes) throw new Error('request body too large')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf-8')
}

export function parseForm(body) {
  return Object.fromEntries(new URLSearchParams(body))
}

// Parse a JSON object body; returns undefined for invalid JSON or non-objects.
export function parseJson(body) {
  try {
    const v = JSON.parse(body)
    return typeof v === 'object' && v !== null && !Array.isArray(v) ? v : undefined
  } catch {
    return undefined
  }
}

export function clientIp(req) {
  const xff = req.headers?.['x-forwarded-for']
  if (xff) return String(xff).split(',')[0].trim()
  return req.socket?.remoteAddress || 'unknown'
}

export function sendJson(res, status, obj) {
  const body = JSON.stringify(obj)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' }).end(body)
}

export function sendText(res, status, body, contentType = 'text/plain; charset=utf-8', extra = {}) {
  res.writeHead(status, { 'content-type': contentType, ...extra }).end(body)
}

export function sendHtml(res, status, html) {
  res.writeHead(status, { 'content-type': 'text/html; charset=utf-8' }).end(html)
}

export function redirect(res, location) {
  res.writeHead(302, { location }).end()
}
