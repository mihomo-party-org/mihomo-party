#!/usr/bin/env -S node --experimental-sqlite --disable-warning=ExperimentalWarning
// cpx-admin CLI entrypoint. Wires the real account DB + a no-echo password reader into
// the tested command logic (src/admin.mjs). The offline signing commands (keygen,
// sign-discovery) never touch the database, so it is only opened for the others.
import { readFileSync, writeFileSync } from 'node:fs'
import { loadConfig } from './src/config.mjs'
import { runAdmin } from './src/admin.mjs'
import { readPassword } from './src/prompt.mjs'

const OFFLINE_COMMANDS = new Set(['keygen', 'sign-discovery'])

const config = loadConfig()
const args = process.argv.slice(2)
let db
if (!OFFLINE_COMMANDS.has(args[0])) {
  const { openDb } = await import('./src/db.mjs')
  db = openDb(config.dbPath)
}
const code = await runAdmin(args, {
  db,
  deviceLimitDefault: config.deviceLimitDefault,
  readPassword,
  readFile: (p) => readFileSync(p, 'utf-8'),
  writeFile: (p, data, opts) => writeFileSync(p, data, opts),
  readStdin: async () => readFileSync(0, 'utf-8'),
  out: (s) => console.log(s),
  err: (s) => console.error(s)
})
db?.close()
process.exit(code)
