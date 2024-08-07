import { controledMihomoConfigPath } from '../utils/dirs'
import yaml from 'yaml'
import fs from 'fs'
import { getAxios, startMihomoMemory, startMihomoTraffic } from '../core/mihomoApi'

export let controledMihomoConfig: Partial<IMihomoConfig> // mihomo.yaml

export function getControledMihomoConfig(force = false): Partial<IMihomoConfig> {
  if (force || !controledMihomoConfig) {
    controledMihomoConfig = yaml.parse(fs.readFileSync(controledMihomoConfigPath(), 'utf-8'))
  }
  return controledMihomoConfig
}

export function setControledMihomoConfig(patch: Partial<IMihomoConfig>): void {
  if (patch.tun) {
    const oldTun = controledMihomoConfig.tun || {}
    const newTun = Object.assign(oldTun, patch.tun)
    patch.tun = newTun
  }
  if (patch.dns) {
    const oldDns = controledMihomoConfig.dns || {}
    const newDns = Object.assign(oldDns, patch.dns)
    patch.dns = newDns
  }
  if (patch.sniffer) {
    const oldSniffer = controledMihomoConfig.sniffer || {}
    const newSniffer = Object.assign(oldSniffer, patch.sniffer)
    patch.sniffer = newSniffer
  }
  controledMihomoConfig = Object.assign(controledMihomoConfig, patch)
  if (patch['external-controller'] || patch.secret) {
    getAxios(true)
    startMihomoMemory()
    startMihomoTraffic()
  }
  fs.writeFileSync(controledMihomoConfigPath(), yaml.stringify(controledMihomoConfig))
}
