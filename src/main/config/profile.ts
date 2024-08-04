import { getControledMihomoConfig } from './controledMihomo'
import { profileConfigPath, profilePath } from '../utils/dirs'
import { restartCore } from '../core/manager'
import { getAppConfig } from './app'
import { window } from '..'
import axios from 'axios'
import yaml from 'yaml'
import fs from 'fs'
import { dialog } from 'electron'

let profileConfig: IProfileConfig // profile.yaml
let currentProfile: Partial<IMihomoConfig> // profiles/xxx.yaml

export function getProfileConfig(force = false): IProfileConfig {
  if (force || !profileConfig) {
    profileConfig = yaml.parse(fs.readFileSync(profileConfigPath(), 'utf-8'))
  }
  return profileConfig
}

export function getProfileItem(id: string | undefined): IProfileItem {
  const items = getProfileConfig().items
  return items?.find((item) => item.id === id) || { id: 'default', type: 'local', name: '空白订阅' }
}

export async function changeCurrentProfile(id: string): Promise<void> {
  const oldId = getProfileConfig().current
  profileConfig.current = id
  getCurrentProfile(true)
  try {
    restartCore()
  } catch (e) {
    profileConfig.current = oldId
    getCurrentProfile(true)
  } finally {
    window?.webContents.send('profileConfigUpdated')
    fs.writeFileSync(profileConfigPath(), yaml.stringify(profileConfig))
  }
}

export async function addProfileItem(item: Partial<IProfileItem>): Promise<void> {
  const newItem = await createProfile(item)
  profileConfig.items.push(newItem)
  if (!getProfileConfig().current) {
    changeCurrentProfile(newItem.id)
  }
  fs.writeFileSync(profileConfigPath(), yaml.stringify(profileConfig))
  window?.webContents.send('profileConfigUpdated')
}

export function removeProfileItem(id: string): void {
  profileConfig.items = profileConfig.items?.filter((item) => item.id !== id)
  if (profileConfig.current === id) {
    profileConfig.current = profileConfig.items[0]?.id
  }
  fs.writeFileSync(profileConfigPath(), yaml.stringify(profileConfig))
  window?.webContents.send('profileConfigUpdated')
}

export function getCurrentProfileItem(): IProfileItem {
  return getProfileItem(getProfileConfig().current)
}

// attachment;filename=xxx.yaml; filename*=UTF-8''%xx%xx%xx
function parseFilename(str: string): string {
  if (str.includes("filename*=UTF-8''")) {
    const filename = decodeURIComponent(str.split("filename*=UTF-8''")[1])
    return filename
  } else {
    const filename = str.split('filename=')[1]
    return filename
  }
}

// subscription-userinfo: upload=1234; download=2234; total=1024000; expire=2218532293
function parseSubinfo(str: string): ISubscriptionUserInfo {
  const parts = str.split('; ')
  const obj = {} as ISubscriptionUserInfo
  parts.forEach((part) => {
    const [key, value] = part.split('=')
    obj[key] = parseInt(value)
  })
  return obj
}

export async function createProfile(item: Partial<IProfileItem>): Promise<IProfileItem> {
  const id = item.id || new Date().getTime().toString(16)
  const newItem = {
    id,
    name: item.name || 'Local File',
    type: item.type || 'local',
    url: item.url,
    interval: item.interval || 0,
    updated: new Date().getTime()
  } as IProfileItem
  switch (newItem.type) {
    case 'remote': {
      if (!item.url) {
        dialog.showErrorBox(
          'URL is required for remote profile',
          'URL is required for remote profile'
        )
        throw new Error('URL is required for remote profile')
      }
      try {
        const ua = getAppConfig().userAgent || 'clash-meta'
        const res = await axios.get(item.url, {
          proxy: {
            protocol: 'http',
            host: '127.0.0.1',
            port: getControledMihomoConfig()['mixed-port'] || 7890
          },
          headers: {
            'User-Agent': ua
          },
          responseType: 'text'
        })
        const data = res.data
        const headers = res.headers
        if (headers['content-disposition']) {
          newItem.name = parseFilename(headers['content-disposition'])
        }
        if (headers['profile-web-page-url']) {
          newItem.home = headers['profile-web-page-url']
        }
        if (headers['profile-update-interval']) {
          newItem.interval = parseInt(headers['profile-update-interval']) * 60
        }
        if (headers['subscription-userinfo']) {
          newItem.extra = parseSubinfo(headers['subscription-userinfo'])
        }
        fs.writeFileSync(profilePath(id), data, 'utf-8')
      } catch (e) {
        dialog.showErrorBox('Failed to fetch remote profile', `${e}\nurl: ${item.url}`)
        throw new Error(`Failed to fetch remote profile ${e}`)
      }
      break
    }
    case 'local': {
      if (!item.file) {
        dialog.showErrorBox(
          'File is required for local profile',
          'File is required for local profile'
        )
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
    const current = getProfileConfig().current
    if (current) {
      currentProfile = yaml.parse(fs.readFileSync(profilePath(current), 'utf-8'))
    } else {
      currentProfile = yaml.parse(fs.readFileSync(profilePath('default'), 'utf-8'))
    }
  }
  return currentProfile
}
