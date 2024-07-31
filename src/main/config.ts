import yaml from 'yaml'
import fs from 'fs'
import { app } from 'electron'
import path from 'path'
import { defaultConfig } from './template'

const dataDir = app.getPath('userData')
const appConfigPath = path.join(dataDir, 'config.yaml')
const controledMihomoConfigPath = path.join(dataDir, 'mihomo.yaml')

export let appConfig: IAppConfig
export let controledMihomoConfig: Partial<IMihomoConfig>

export function initConfig(): void {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir)
  }
  if (!fs.existsSync(appConfigPath)) {
    fs.writeFileSync(appConfigPath, yaml.stringify(defaultConfig))
  }
  if (!fs.existsSync(controledMihomoConfigPath)) {
    fs.writeFileSync(controledMihomoConfigPath, yaml.stringify({}))
  }
  getAppConfig(true)
  getControledMihomoConfig(true)
}

export function getAppConfig(force = false): IAppConfig {
  if (force || !appConfig) {
    appConfig = yaml.parse(fs.readFileSync(appConfigPath, 'utf-8'))
  }
  return appConfig
}

export function setAppConfig(patch: Partial<IAppConfig>): void {
  appConfig = Object.assign(appConfig, patch)
  fs.writeFileSync(appConfigPath, yaml.stringify(appConfig))
}

export function getControledMihomoConfig(force = false): Partial<IMihomoConfig> {
  if (force || !controledMihomoConfig) {
    controledMihomoConfig = yaml.parse(fs.readFileSync(controledMihomoConfigPath, 'utf-8'))
  }
  return controledMihomoConfig
}

export function setControledMihomoConfig(patch: Partial<IMihomoConfig>): void {
  controledMihomoConfig = Object.assign(controledMihomoConfig, patch)
  fs.writeFileSync(controledMihomoConfigPath, yaml.stringify(controledMihomoConfig))
}
