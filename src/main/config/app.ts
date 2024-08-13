import { readFile, writeFile } from 'fs/promises'
import { appConfigPath } from '../utils/dirs'
import yaml from 'yaml'

let appConfig: IAppConfig // config.yaml

export async function getAppConfig(force = false): Promise<IAppConfig> {
  if (force || !appConfig) {
    const data = await readFile(appConfigPath(), 'utf-8')
    appConfig = yaml.parse(data)
  }
  return appConfig
}

export async function patchAppConfig(patch: Partial<IAppConfig>): Promise<void> {
  if (patch.sysProxy) {
    const oldSysProxy = appConfig.sysProxy || {}
    const newSysProxy = Object.assign(oldSysProxy, patch.sysProxy)
    patch.sysProxy = newSysProxy
  }
  appConfig = Object.assign(appConfig, patch)
  await writeFile(appConfigPath(), yaml.stringify(appConfig))
}
