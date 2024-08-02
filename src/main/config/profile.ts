import { controledMihomoConfig } from './controledMihomo'
import { profileConfigPath, profilePath } from '../utils/dirs'
import { app } from 'electron'
import axios from 'axios'
import yaml from 'yaml'
import fs from 'fs'

export let profileConfig: IProfileConfig // profile.yaml
export let currentProfile: Partial<IMihomoConfig> // profiles/xxx.yaml

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
