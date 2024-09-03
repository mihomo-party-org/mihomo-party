import { controledMihomoConfigPath } from '../utils/dirs'
import { readFile, writeFile } from 'fs/promises'
import yaml from 'yaml'
import { getAxios } from '../core/mihomoApi'
import { generateProfile } from '../core/factory'
import { getAppConfig } from './app'
import { defaultControledMihomoConfig } from '../utils/template'
import { deepMerge } from '../utils/merge'

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
  if (!controlDns) {
    delete controledMihomoConfig.dns
    delete controledMihomoConfig.hosts
  } else {
    // 从不接管状态恢复
    if (controledMihomoConfig.dns?.ipv6 === undefined) {
      controledMihomoConfig.dns = defaultControledMihomoConfig.dns
    }
  }
  if (!controlSniff) {
    delete controledMihomoConfig.sniffer
  } else {
    // 从不接管状态恢复
    if (!controledMihomoConfig.sniffer) {
      controledMihomoConfig.sniffer = defaultControledMihomoConfig.sniffer
    }
  }
  if (patch.hosts) {
    controledMihomoConfig.hosts = patch.hosts
  }
  if (patch.dns?.['nameserver-policy']) {
    controledMihomoConfig.dns = controledMihomoConfig.dns || {}
    controledMihomoConfig.dns['nameserver-policy'] = patch.dns['nameserver-policy']
  }
  controledMihomoConfig = deepMerge(controledMihomoConfig, patch)
  if (!useNameserverPolicy) {
    delete controledMihomoConfig?.dns?.['nameserver-policy']
  }

  if (patch['external-controller'] || patch.secret) {
    await getAxios(true)
  }
  await generateProfile()
  await writeFile(controledMihomoConfigPath(), yaml.stringify(controledMihomoConfig), 'utf-8')
}
