import { controledMihomoConfig, currentProfile } from '../config'
import { mihomoWorkConfigPath } from '../utils/dirs'
import yaml from 'yaml'
import fs from 'fs'

export function generateProfile(): void {
  const profile = Object.assign(currentProfile, controledMihomoConfig)
  fs.writeFileSync(mihomoWorkConfigPath(), yaml.stringify(profile))
}
