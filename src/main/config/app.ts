import { readFile, writeFile } from 'fs/promises'
import { appConfigPath } from '../utils/dirs'
import yaml from 'yaml'
import { deepMerge } from '../utils/merge'

let appConfig: IAppConfig // config.yaml

export async function getAppConfig(force = false): Promise<IAppConfig> {
  if (force || !appConfig) {
    const data = await readFile(appConfigPath(), 'utf-8')
    appConfig = yaml.parse(data)
  }
  return appConfig
}

export async function patchAppConfig(patch: Partial<IAppConfig>): Promise<void> {
  appConfig = deepMerge(appConfig, patch)
  await writeFile(appConfigPath(), yaml.stringify(appConfig))
}
