import { test } from 'node:test'
import assert from 'node:assert/strict'
import { openDb } from './db.mjs'
import { verifyPassword } from './crypto.mjs'
import { runAdmin } from './admin.mjs'

function harness({ password = 'pw' } = {}) {
  const lines = []
  const db = openDb(':memory:')
  const deps = {
    db,
    readPassword: async () => password,
    out: (s) => lines.push(String(s)),
    err: (s) => lines.push('ERR:' + s)
  }
  return { db, deps, lines, text: () => lines.join('\n') }
}

test('add-user creates a user with a hashed password and a device limit', async () => {
  const h = harness({ password: 's3cret' })
  const code = await runAdmin(
    ['add-user', 'alice', 'https://o.example/sub?t=1', '--limit', '5'],
    h.deps
  )
  assert.equal(code, 0)
  const u = h.db.getUser('alice')
  assert.equal(u.subUrl, 'https://o.example/sub?t=1')
  assert.equal(u.deviceLimit, 5)
  assert.equal(verifyPassword('s3cret', u.pwdHash), true)
})

test('add-user rejects a duplicate username with a non-zero exit', async () => {
  const h = harness()
  await runAdmin(['add-user', 'alice', 'https://o/sub'], h.deps)
  const code = await runAdmin(['add-user', 'alice', 'https://o/sub'], h.deps)
  assert.notEqual(code, 0)
  assert.match(h.text(), /exists/i)
})

test('set-sub / set-limit / passwd update an existing user', async () => {
  const h = harness({ password: 'new-pw' })
  await runAdmin(['add-user', 'alice', 'https://o/sub'], h.deps)
  await runAdmin(['set-sub', 'alice', 'https://o/sub2'], h.deps)
  await runAdmin(['set-limit', 'alice', '9'], h.deps)
  await runAdmin(['passwd', 'alice'], h.deps)
  const u = h.db.getUser('alice')
  assert.equal(u.subUrl, 'https://o/sub2')
  assert.equal(u.deviceLimit, 9)
  assert.equal(verifyPassword('new-pw', u.pwdHash), true)
})

test('del-user removes the user and its devices', async () => {
  const h = harness()
  await runAdmin(['add-user', 'alice', 'https://o/sub'], h.deps)
  h.db.upsertDevice({ deviceId: 'd1', username: 'alice', pubKey: 'K' })
  const code = await runAdmin(['del-user', 'alice'], h.deps)
  assert.equal(code, 0)
  assert.equal(h.db.getUser('alice'), undefined)
  assert.equal(h.db.getDevice('d1'), undefined)
})

test('list-users hides the full subUrl by default and shows it with --show-sub', async () => {
  const h = harness()
  await runAdmin(['add-user', 'alice', 'https://secret.example/sub?token=XYZ'], h.deps)
  await runAdmin(['list-users'], h.deps)
  assert.match(h.text(), /secret\.example/)
  assert.doesNotMatch(h.text(), /token=XYZ/)
  await runAdmin(['list-users', '--show-sub'], h.deps)
  assert.match(h.text(), /token=XYZ/)
})

test('list-devices and revoke-device manage bindings', async () => {
  const h = harness()
  await runAdmin(['add-user', 'alice', 'https://o/sub'], h.deps)
  h.db.upsertDevice({ deviceId: 'dev-abc', username: 'alice', pubKey: 'K' })
  await runAdmin(['list-devices', 'alice'], h.deps)
  assert.match(h.text(), /dev-abc/)
  const code = await runAdmin(['revoke-device', 'dev-abc'], h.deps)
  assert.equal(code, 0)
  assert.equal(h.db.getDevice('dev-abc'), undefined)
})

test('operating on a missing user is a non-zero exit with a clear message', async () => {
  const h = harness()
  const code = await runAdmin(['set-sub', 'ghost', 'https://o/sub'], h.deps)
  assert.notEqual(code, 0)
  assert.match(h.text(), /not found/i)
})

test('an unknown command returns non-zero and prints usage', async () => {
  const h = harness()
  const code = await runAdmin(['frobnicate'], h.deps)
  assert.notEqual(code, 0)
  assert.match(h.text(), /usage/i)
})

// ---------- §5a offline signing ----------
import { verifyDiscoveryEnvelope } from './crypto.mjs'

function fsHarness() {
  const files = new Map()
  const h = harness()
  h.deps.readFile = (p) => {
    if (!files.has(p)) throw new Error(`ENOENT ${p}`)
    const entry = files.get(p)
    return typeof entry === 'string' ? entry : entry.data
  }
  h.deps.writeFile = (p, data, opts) => {
    if (opts?.flag === 'wx' && files.has(p)) {
      throw Object.assign(new Error(`EEXIST: file already exists, open '${p}'`), { code: 'EEXIST' })
    }
    files.set(p, { data, mode: opts?.mode, flag: opts?.flag })
  }
  h.deps.readStdin = async () => files.get('<stdin>')?.data ?? ''
  return { ...h, files }
}

test('keygen writes a 0600 seed file and prints the public key; never prints the seed', async () => {
  const h = fsHarness()
  const code = await runAdmin(['keygen', '--out', '/tmp/seed'], h.deps)
  assert.equal(code, 0)
  const seedFile = h.files.get('/tmp/seed')
  assert.equal(seedFile.mode, 0o600)
  const seed = Buffer.from(seedFile.data.trim(), 'base64')
  assert.equal(seed.length, 32)
  assert.match(h.text(), /providerPubKey: [A-Za-z0-9+/]+=*/)
  assert.ok(!h.text().includes(seedFile.data.trim()))
})

test('keygen refuses to run without --out', async () => {
  const h = fsHarness()
  assert.notEqual(await runAdmin(['keygen'], h.deps), 0)
})

test('sign-discovery reads the seed from a file or stdin and emits an envelope the client accepts', async () => {
  const h = fsHarness()
  await runAdmin(['keygen', '--out', '/k/seed'], h.deps)
  const pub = h.text().match(/providerPubKey: (\S+)/)[1]
  const payload = {
    spec: 'cpx-plugin/2',
    seq: 3,
    gateways: ['https://gw.example.net'],
    endpoints: { enroll: '/enroll', challenge: '/challenge', config: '/config', revoke: '/revoke' }
  }
  h.files.set('/k/payload.json', JSON.stringify(payload))
  const lines1 = h.lines.length
  const code = await runAdmin(
    ['sign-discovery', '/k/payload.json', '--seed-file', '/k/seed', '--out', '/k/envelope'],
    h.deps
  )
  assert.equal(code, 0)
  const envelope = h.lines[lines1]
  assert.equal(h.files.get('/k/envelope').data.trim(), envelope)
  const bytes = verifyDiscoveryEnvelope(envelope, pub)
  assert.deepEqual(JSON.parse(bytes.toString('utf-8')), payload)

  // stdin path produces the same signature (Ed25519 is deterministic)
  h.files.set('<stdin>', { data: h.files.get('/k/seed').data })
  const lines2 = h.lines.length
  assert.equal(await runAdmin(['sign-discovery', '/k/payload.json'], h.deps), 0)
  assert.equal(h.lines[lines2], envelope)
})

test('sign-discovery rejects a bad seed and a malformed payload', async () => {
  const h = fsHarness()
  h.files.set('/k/seed', { data: 'not-a-seed' })
  h.files.set(
    '/k/payload.json',
    JSON.stringify({ spec: 'cpx-plugin/2', seq: 1, gateways: ['https://a'], endpoints: {} })
  )
  assert.notEqual(
    await runAdmin(['sign-discovery', '/k/payload.json', '--seed-file', '/k/seed'], h.deps),
    0
  )
  h.files.set('/k/seed', { data: Buffer.alloc(32, 1).toString('base64') })
  h.files.set('/k/bad.json', JSON.stringify({ spec: 'cpx-plugin/2', seq: 0, gateways: [] }))
  assert.notEqual(
    await runAdmin(['sign-discovery', '/k/bad.json', '--seed-file', '/k/seed'], h.deps),
    0
  )
})

test('ISS-016: keygen creates the seed file exclusively and refuses an existing path', async () => {
  const h = fsHarness()
  assert.equal(await runAdmin(['keygen', '--out', '/k/seed'], h.deps), 0)
  assert.equal(h.files.get('/k/seed').flag, 'wx')
  assert.equal(h.files.get('/k/seed').mode, 0o600)
  const before = h.files.get('/k/seed').data
  assert.notEqual(await runAdmin(['keygen', '--out', '/k/seed'], h.deps), 0)
  assert.equal(h.files.get('/k/seed').data, before)
  assert.match(h.text(), /refusing to overwrite/)
})

test('ISS-018: sign-discovery refuses a payload the client would reject', async () => {
  const h = fsHarness()
  await runAdmin(['keygen', '--out', '/k/seed'], h.deps)
  h.files.set(
    '/k/bad1.json',
    JSON.stringify({
      spec: 'cpx-plugin/2',
      seq: 1,
      gateways: ['https://10.0.0.1'],
      endpoints: {
        enroll: '/enroll',
        challenge: '/challenge',
        config: '/config',
        revoke: '/revoke'
      }
    })
  )
  assert.notEqual(
    await runAdmin(['sign-discovery', '/k/bad1.json', '--seed-file', '/k/seed'], h.deps),
    0
  )
  assert.match(h.text(), /public https origin/)
  h.files.set(
    '/k/bad2.json',
    JSON.stringify({
      spec: 'cpx-plugin/2',
      seq: 1,
      gateways: ['https://gw.example.net'],
      endpoints: {
        enroll: '/enroll',
        challenge: '/challenge',
        config: '/config',
        revoke: '/revoke'
      },
      extra: true
    })
  )
  assert.notEqual(
    await runAdmin(['sign-discovery', '/k/bad2.json', '--seed-file', '/k/seed'], h.deps),
    0
  )
  assert.match(h.text(), /unknown key/)
})
