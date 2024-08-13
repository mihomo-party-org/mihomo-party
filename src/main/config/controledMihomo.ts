import { controledMihomoConfigPath } from '../utils/dirs'
import { readFile, writeFile } from 'fs/promises'
import yaml from 'yaml'
import { getAxios, startMihomoMemory, startMihomoTraffic } from '../core/mihomoApi'
import { generateProfile } from '../resolve/factory'
import { getAppConfig } from './app'

let controledMihomoConfig: Partial<IMihomoConfig> // mihomo.yaml

export async function getControledMihomoConfig(force = false): Promise<Partial<IMihomoConfig>> {
  if (force || !controledMihomoConfig) {
    const data = await readFile(controledMihomoConfigPath(), 'utf-8')
    controledMihomoConfig = yaml.parse(data)
  }
  return controledMihomoConfig
}

export async function patchControledMihomoConfig(patch: Partial<IMihomoConfig>): Promise<void> {
  const { useNameserverPolicy } = await getAppConfig()
  if (patch.tun) {
    const oldTun = controledMihomoConfig.tun || {}
    const newTun = Object.assign(oldTun, patch.tun)
    patch.tun = newTun
  }
  if (patch.dns) {
    const oldDns = controledMihomoConfig.dns || {}
    const newDns = Object.assign(oldDns, patch.dns)
    if (!useNameserverPolicy) {
      delete newDns['nameserver-policy']
    }
    patch.dns = newDns
  }
  if (patch.sniffer) {
    const oldSniffer = controledMihomoConfig.sniffer || {}
    const newSniffer = Object.assign(oldSniffer, patch.sniffer)
    patch.sniffer = newSniffer
  }
  controledMihomoConfig = Object.assign(controledMihomoConfig, patch)

  if (patch['external-controller'] || patch.secret) {
    await getAxios(true)
    await startMihomoMemory()
    await startMihomoTraffic()
  }
  await generateProfile()
  await writeFile(controledMihomoConfigPath(), yaml.stringify(controledMihomoConfig), 'utf-8')
}
