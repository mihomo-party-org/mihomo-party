// Usage: node scripts/plugin/gen-cpx.mjs <loginUrl> <providerName> [site] [out.cpx] [--discovery <origin>]... [--pubkey <b64>]
// --discovery may be repeated (1..8 public https origins, not the loginUrl origin): backup
// discovery sources the client tries after the login host for /.well-known/cpx-gateway.
// --pubkey: Ed25519 raw 32-byte public key (standard base64) printed by sign-discovery.mjs /
// cpx-admin keygen. Once present, clients REQUIRE a signed discovery document — publish the
// signed well-known first (integration guide §5a).
import { writeFileSync } from 'fs'
// Same public-host rules the client enforces on import (descriptor.ts / gateway-url.ts), so the
// generator cannot emit a file the client rejects. Zero-dependency helpers from the reference gateway.
import { isForbiddenHost, parseOrigin } from '../../deploy/gateway/src/discovery.mjs'

const positional = []
const discoveryUrls = []
let pubkey
const argv = process.argv.slice(2)
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (a === '--pubkey') {
    pubkey = argv[++i]
    if (!pubkey) {
      console.error('--pubkey requires a base64 value')
      process.exit(1)
    }
  } else if (a.startsWith('--pubkey=')) {
    pubkey = a.slice('--pubkey='.length)
  } else if (a === '--discovery') {
    const v = argv[++i]
    if (!v) {
      console.error('--discovery requires an https origin')
      process.exit(1)
    }
    discoveryUrls.push(v)
  } else if (a.startsWith('--discovery=')) {
    discoveryUrls.push(a.slice('--discovery='.length))
  } else {
    positional.push(a)
  }
}

const [loginUrl, name, site, out = 'plugin.cpx'] = positional
if (!loginUrl || !name) {
  console.error(
    'Usage: node gen-cpx.mjs <loginUrl https authorize> <providerName> [site] [out.cpx] [--discovery <origin>]...'
  )
  process.exit(1)
}
let u
try {
  u = new URL(loginUrl)
} catch {
  console.error('loginUrl: not a valid URL')
  process.exit(1)
}
if (u.protocol !== 'https:' || u.search || u.hash) {
  console.error('loginUrl must be https with no query/fragment')
  process.exit(1)
}
if (u.username || u.password || isForbiddenHost(u.hostname)) {
  console.error(
    'loginUrl must use a public host without userinfo (the client rejects private/loopback hosts)'
  )
  process.exit(1)
}
// 旧位置参数用法允许用空字符串占位 site（`… "" out.cpx`），此时不输出 site 字段，也不校验
if (site) {
  let s
  try {
    s = new URL(site)
  } catch {
    console.error('site: not a valid URL')
    process.exit(1)
  }
  if (s.protocol !== 'https:' || s.username || s.password || isForbiddenHost(s.hostname)) {
    console.error('site must be a public https URL without userinfo')
    process.exit(1)
  }
}

const origins = []
for (const raw of discoveryUrls) {
  const origin = parseOrigin(raw)
  if (!origin) {
    console.error(
      `--discovery ${raw}: must be a public https origin (no path/query/fragment/userinfo)`
    )
    process.exit(1)
  }
  if (origin === u.origin) {
    console.error(`--discovery ${raw}: must differ from the loginUrl origin`)
    process.exit(1)
  }
  if (!origins.includes(origin)) origins.push(origin)
}
if (origins.length > 8) {
  console.error('at most 8 --discovery origins')
  process.exit(1)
}

if (pubkey !== undefined) {
  const raw = Buffer.from(pubkey, 'base64')
  if (raw.length !== 32 || raw.toString('base64') !== pubkey) {
    console.error('--pubkey must be a 32-byte Ed25519 public key in standard base64 with padding')
    process.exit(1)
  }
}

const descriptor = {
  magic: 'CPXF',
  v: 2,
  spec: 'cpx-plugin/2',
  loginUrl,
  provider: { name, ...(site ? { site } : {}) },
  ...(origins.length ? { discoveryUrls: origins } : {}),
  ...(pubkey ? { providerPubKey: pubkey } : {})
}
writeFileSync(out, JSON.stringify(descriptor, null, 2) + '\n')
console.log('wrote', out)
