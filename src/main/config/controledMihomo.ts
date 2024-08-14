import { controledMihomoConfigPath } from '../utils/dirs'
import { readFile, writeFile } from 'fs/promises'
import yaml from 'yaml'
import { getAxios, startMihomoMemory, startMihomoTraffic } from '../core/mihomoApi'
import { generateProfile } from '../resolve/factory'
import { getAppConfig } from './app'
import { defaultControledMihomoConfig } from '../utils/template'

let controledMihomoConfig: Partial<IMihomoConfig> // mihomo.yaml

export async function getControledMihomoConfig(force = false): Promise<Partial<IMihomoConfig>> {
  if (force || !controledMihomoConfig) {
    const data = await readFile(controledMihomoConfigPath(), 'utf-8')
    controledMihomoConfig = yaml.parse(data)
  }
  return controledMihomoConfig
}

export async function patchControledMihomoConfig(patch: Partial<IMihomoConfig>): Promise<void> {
  const { useNameserverPolicy, controlDns = true, controlSniff = true } = await getAppConfig()
  if (patch.tun) {
    const oldTun = controledMihomoConfig.tun || {}
    const newTun = Object.assign(oldTun, patch.tun)
    patch.tun = newTun
  }
  if (!controlDns) {
    delete controledMihomoConfig.dns
    delete controledMihomoConfig.hosts
  } else {
    // 从不接管状态恢复
    if (controledMihomoConfig.dns?.ipv6 === undefined) {
      controledMihomoConfig.dns = defaultControledMihomoConfig.dns
    }
  }
  if (patch.dns) {
    const oldDns = controledMihomoConfig.dns || {}
    const newDns = Object.assign(oldDns, patch.dns)
    if (!useNameserverPolicy) {
      delete newDns['nameserver-policy']
    }
    patch.dns = newDns
  }
  if (!controlSniff) {
    delete controledMihomoConfig.sniffer
  } else {
    // 从不接管状态恢复
    if (!controledMihomoConfig.sniffer) {
      controledMihomoConfig.sniffer = defaultControledMihomoConfig.sniffer
    }
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
