import yaml from 'yaml'
import { readFileSync, writeFileSync } from 'fs'

const pkg = readFileSync('package.json', 'utf-8')
const changelog = readFileSync('changelog.md', 'utf-8')
const { version } = JSON.parse(pkg)
const latest = {
  version,
  changelog
}

writeFileSync('latest.yml', yaml.stringify(latest))
