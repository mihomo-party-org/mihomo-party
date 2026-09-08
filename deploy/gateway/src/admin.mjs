// Admin command logic, decoupled from I/O so it is testable. The bin wrapper
// (../admin.mjs) supplies a real db, a no-echo password reader, and console writers.
import { generateSeed, hashPassword, pubKeyFromSeed, signDiscovery } from './crypto.mjs'
import { validateDiscoveryPayload } from './discovery.mjs'

const USAGE = `Usage: cpx-admin <command> ...
  add-user <username> <subUrl> [--limit N]
  set-sub <username> <subUrl>
  passwd <username>
  set-limit <username> <N>
  del-user <username>
  list-users [--show-sub]
  list-devices <username>
  revoke-device <deviceId>
  keygen --out <seed-file>                       (offline; seed file is written with mode 0600)
  sign-discovery <payload.json> [--seed-file <path>] [--out <envelope>]
                                                 (offline; seed from --seed-file or stdin)`

function parse(rest) {
  const pos = []
  const flags = {}
  for (let i = 0; i < rest.length; i++) {
    const t = rest[i]
    if (t === '--limit') flags.limit = rest[++i]
    else if (t === '--out') flags.out = rest[++i]
    else if (t === '--seed-file') flags.seedFile = rest[++i]
    else if (t === '--show-sub') flags.showSub = true
    else if (t.startsWith('--')) flags[t.slice(2)] = true
    else pos.push(t)
  }
  return { pos, flags }
}

function hostOf(url) {
  try {
    return new URL(url).host
  } catch {
    return '(invalid url)'
  }
}

export async function runAdmin(args, deps) {
  const { db, readPassword, out, err } = deps
  const defaultLimit = deps.deviceLimitDefault ?? 3
  const [cmd, ...rest] = args
  const { pos, flags } = parse(rest)
  const need = (ok, msg) => {
    if (!ok) err(msg)
    return ok
  }
  const requireUser = (name) => {
    if (db.getUser(name)) return true
    err(`user "${name}" not found`)
    return false
  }

  switch (cmd) {
    case 'add-user': {
      const [username, subUrl] = pos
      if (!need(username && subUrl, 'add-user requires <username> <subUrl>')) return 1
      if (db.getUser(username)) {
        err(`user "${username}" already exists`)
        return 1
      }
      const password = await readPassword('Password: ')
      if (!need(password, 'empty password')) return 1
      const deviceLimit = flags.limit ? Number(flags.limit) : defaultLimit
      db.addUser({ username, pwdHash: hashPassword(password), subUrl, deviceLimit })
      out(`added user "${username}" (device limit ${deviceLimit})`)
      return 0
    }
    case 'set-sub': {
      const [username, subUrl] = pos
      if (!need(username && subUrl, 'set-sub requires <username> <subUrl>')) return 1
      if (!requireUser(username)) return 1
      db.setSub(username, subUrl)
      out(`updated subscription for "${username}"`)
      return 0
    }
    case 'set-limit': {
      const [username, n] = pos
      if (!need(username && n, 'set-limit requires <username> <N>')) return 1
      if (!requireUser(username)) return 1
      db.setLimit(username, Number(n))
      out(`set device limit ${Number(n)} for "${username}"`)
      return 0
    }
    case 'passwd': {
      const [username] = pos
      if (!need(username, 'passwd requires <username>')) return 1
      if (!requireUser(username)) return 1
      const password = await readPassword('Password: ')
      if (!need(password, 'empty password')) return 1
      db.setPwd(username, hashPassword(password))
      out(`changed password for "${username}"`)
      return 0
    }
    case 'del-user': {
      const [username] = pos
      if (!need(username, 'del-user requires <username>')) return 1
      if (!requireUser(username)) return 1
      db.delUser(username)
      out(`deleted user "${username}" and its devices`)
      return 0
    }
    case 'list-users': {
      for (const u of db.listUsers()) {
        const sub = flags.showSub ? u.subUrl : hostOf(u.subUrl)
        out(
          `${u.username}\tdevices=${u.deviceCount}/${u.deviceLimit}\t${sub}\t${new Date(u.created).toISOString()}`
        )
      }
      return 0
    }
    case 'list-devices': {
      const [username] = pos
      if (!need(username, 'list-devices requires <username>')) return 1
      if (!requireUser(username)) return 1
      for (const d of db.listDevices(username)) {
        out(`${d.deviceId}\t${new Date(d.created).toISOString()}`)
      }
      return 0
    }
    case 'revoke-device': {
      const [deviceId] = pos
      if (!need(deviceId, 'revoke-device requires <deviceId>')) return 1
      db.delDevice(deviceId)
      out(`revoked device ${deviceId}`)
      return 0
    }
    // ---- §5a offline discovery signing (no db access) ----
    case 'keygen': {
      if (!need(flags.out, 'keygen requires --out <seed-file> (the seed is never printed)'))
        return 1
      const seed = generateSeed()
      try {
        // exclusive create: never truncate/reuse an existing file (which would keep its old
        // permissions) and never follow a pre-placed symlink
        deps.writeFile(flags.out, seed.toString('base64') + '\n', { mode: 0o600, flag: 'wx' })
      } catch (e) {
        err(
          e?.code === 'EEXIST'
            ? `refusing to overwrite existing file ${flags.out}`
            : `cannot write ${flags.out}: ${e?.message ?? e}`
        )
        return 1
      }
      out(`wrote seed to ${flags.out} (mode 0600) — keep it offline`)
      out(`providerPubKey: ${pubKeyFromSeed(seed)}`)
      return 0
    }
    case 'sign-discovery': {
      const [payloadPath] = pos
      if (!need(payloadPath, 'sign-discovery requires <payload.json>')) return 1
      const seedText = String(
        flags.seedFile ? deps.readFile(flags.seedFile) : await deps.readStdin()
      ).trim()
      const seed = Buffer.from(seedText, 'base64')
      if (
        !need(
          seed.length === 32 && seed.toString('base64') === seedText,
          'seed must be 32 raw bytes in standard base64'
        )
      ) {
        return 1
      }
      let payload
      try {
        payload = JSON.parse(String(deps.readFile(payloadPath)))
      } catch {
        err(`cannot parse ${payloadPath}`)
        return 1
      }
      // the same field rules the client enforces — a document that fails here would be rejected
      // by every keyed client after publication
      try {
        payload = validateDiscoveryPayload(payload)
      } catch (e) {
        err(e.message)
        return 1
      }
      let signed
      try {
        signed = signDiscovery(Buffer.from(JSON.stringify(payload), 'utf-8'), seed)
      } catch (e) {
        err(e.message)
        return 1
      }
      if (flags.out) deps.writeFile(flags.out, signed + '\n', { mode: 0o644 })
      out(signed)
      err(`providerPubKey: ${pubKeyFromSeed(seed)}`)
      return 0
    }
    default:
      err(USAGE)
      return 1
  }
}
