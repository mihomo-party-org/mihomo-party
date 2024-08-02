import { controledMihomoConfigPath } from '../utils/dirs'
import yaml from 'yaml'
import fs from 'fs'

export let controledMihomoConfig: Partial<IMihomoConfig> // mihomo.yaml

export function getControledMihomoConfig(force = false): Partial<IMihomoConfig> {
  if (force || !controledMihomoConfig) {
    controledMihomoConfig = yaml.parse(fs.readFileSync(controledMihomoConfigPath(), 'utf-8'))
  }
  return controledMihomoConfig
}

export function setControledMihomoConfig(patch: Partial<IMihomoConfig>): void {
  controledMihomoConfig = Object.assign(controledMihomoConfig, patch)
  fs.writeFileSync(controledMihomoConfigPath(), yaml.stringify(controledMihomoConfig))
}
