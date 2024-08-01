import yaml from 'yaml'
import fs from 'fs'
import {
  defaultConfig,
  defaultControledMihomoConfig,
  defaultProfile,
  defaultProfileConfig
} from './template'
import { appConfigPath, controledMihomoConfigPath, profileConfigPath, profilePath } from './dirs'

export let appConfig: IAppConfig // config.yaml
export let profileConfig: IProfileConfig // profile.yaml
export let currentProfile: Partial<IMihomoConfig> // profiles/xxx.yaml
export let controledMihomoConfig: Partial<IMihomoConfig> // mihomo.yaml

export function initConfig(): void {
  if (!fs.existsSync(appConfigPath())) {
    fs.writeFileSync(appConfigPath(), yaml.stringify(defaultConfig))
  }
  if (!fs.existsSync(profileConfigPath())) {
    fs.writeFileSync(profileConfigPath(), yaml.stringify(defaultProfileConfig))
  }
  if (!fs.existsSync(profilePath('default'))) {
    fs.writeFileSync(profilePath('default'), yaml.stringify(defaultProfile))
  }
  if (!fs.existsSync(controledMihomoConfigPath())) {
    fs.writeFileSync(controledMihomoConfigPath(), yaml.stringify(defaultControledMihomoConfig))
  }
  getAppConfig(true)
  getControledMihomoConfig(true)
  getProfileConfig(true)
  getCurrentProfile(true)
}

export function getAppConfig(force = false): IAppConfig {
  if (force || !appConfig) {
    appConfig = yaml.parse(fs.readFileSync(appConfigPath(), 'utf-8'))
  }
  return appConfig
}

export function setAppConfig(patch: Partial<IAppConfig>): void {
  appConfig = Object.assign(appConfig, patch)
  fs.writeFileSync(appConfigPath(), yaml.stringify(appConfig))
}

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

export function getProfileConfig(force = false): IProfileConfig {
  if (force || !profileConfig) {
    profileConfig = yaml.parse(fs.readFileSync(profileConfigPath(), 'utf-8'))
  }
  return profileConfig
}

export function getProfileItem(id: string | undefined): IProfileItem {
  const items = profileConfig.items
  return items?.find((item) => item.id === id) || { id: 'default', type: 'local', name: '空白订阅' }
}

export function addProfileItem(item: IProfileItem): void {
  profileConfig.items.push(item)
  if (!profileConfig.current) {
    profileConfig.current = item.id
  }
  fs.writeFileSync(profileConfigPath(), yaml.stringify(profileConfig))
}

export function removeProfileItem(id: string): void {
  profileConfig.items = profileConfig.items?.filter((item) => item.id !== id)
  if (profileConfig.current === id) {
    profileConfig.current = profileConfig.items[0]?.id
  }
  fs.writeFileSync(profileConfigPath(), yaml.stringify(profileConfig))
}

export function getCurrentProfileItem(): IProfileItem {
  return getProfileItem(profileConfig.current)
}
export function getCurrentProfile(force = false): Partial<IMihomoConfig> {
  if (force || !currentProfile) {
    if (profileConfig.current) {
      currentProfile = yaml.parse(fs.readFileSync(profilePath(profileConfig.current), 'utf-8'))
    } else {
      currentProfile = yaml.parse(fs.readFileSync(profilePath('default'), 'utf-8'))
    }
  }
  return currentProfile
}
