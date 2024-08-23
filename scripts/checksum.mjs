import { readFileSync, readdirSync, writeFileSync } from 'fs'
import { createHash } from 'crypto'
const files = readdirSync('dist')

for (const file of files) {
  for (const ext of process.argv.slice(2)) {
    if (file.endsWith(ext)) {
      const content = readFileSync(`dist/${file}`)
      const checksum = createHash('sha256').update(content, 'utf8').digest('hex')
      writeFileSync(`dist/${file}.sha256`, checksum)
    }
  }
}
