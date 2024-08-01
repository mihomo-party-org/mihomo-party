import yaml from 'yaml'
import fs from 'fs'
import {
  defaultConfig,
  defaultControledMihomoConfig,
  defaultProfile,
  defaultProfileConfig
} from './template'
import { appConfigPath, controledMihomoConfigPath, profileConfigPath, profilePath } from './dirs'
import axios from 'axios'
import { app } from 'electron'

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

export async function addProfileItem(item: Partial<IProfileItem>): Promise<void> {
  const newItem = await createProfile(item)
  profileConfig.items.push(newItem)
  console.log(!profileConfig.current)
  if (!profileConfig.current) {
    profileConfig.current = newItem.id
  }
  console.log(profileConfig.current)
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

export async function createProfile(item: Partial<IProfileItem>): Promise<IProfileItem> {
  const id = item.id || new Date().getTime().toString(16)
  const newItem = {
    id,
    name: item.name || 'Local File',
    type: item.type || 'local',
    url: item.url,
    updated: new Date().getTime()
  } as IProfileItem
  switch (newItem.type) {
    case 'remote': {
      if (!item.url) {
        throw new Error('URL is required for remote profile')
      }
      try {
        const res = await axios.get(item.url, {
          proxy: {
            protocol: 'http',
            host: '127.0.0.1',
            port: controledMihomoConfig['mixed-port'] || 7890
          },
          headers: {
            'User-Agent': `Mihomo.Party.${app.getVersion()}`
          },
          responseType: 'text'
        })
        const data = res.data
        const headers = res.headers
        if (headers['content-disposition']) {
          newItem.name = headers['content-disposition'].split('filename=')[1]
        }
        if (headers['subscription-userinfo']) {
          const extra = headers['subscription-userinfo']
            .split(';')
            .map((item: string) => item.split('=')[1].trim())
          newItem.extra = {
            upload: parseInt(extra[0]),
            download: parseInt(extra[1]),
            total: parseInt(extra[2]),
            expire: parseInt(extra[3])
          }
        }
        fs.writeFileSync(profilePath(id), data, 'utf-8')
      } catch (e) {
        throw new Error(`Failed to fetch remote profile ${e}`)
      }
      break
    }
    case 'local': {
      if (!item.file) {
        throw new Error('File is required for local profile')
      }
      const data = item.file
      fs.writeFileSync(profilePath(id), yaml.stringify(data))
      break
    }
  }

  return newItem
}
