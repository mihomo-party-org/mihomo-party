import { appConfigPath } from '../utils/dirs'
import yaml from 'yaml'
import fs from 'fs'

export let appConfig: IAppConfig // config.yaml

export function getAppConfig(force = false): IAppConfig {
  if (force || !appConfig) {
    appConfig = yaml.parse(fs.readFileSync(appConfigPath(), 'utf-8'))
  }
  return appConfig
}

export function setAppConfig(patch: Partial<IAppConfig>): void {
  if (patch.sysProxy) {
    const oldSysProxy = appConfig.sysProxy || {}
    const newSysProxy = Object.assign(oldSysProxy, patch.sysProxy)
    patch.sysProxy = newSysProxy
  }
  appConfig = Object.assign(appConfig, patch)
  fs.writeFileSync(appConfigPath(), yaml.stringify(appConfig))
}
