import { getControledMihomoConfig } from './controledMihomo'
import { profileConfigPath, profilePath } from '../utils/dirs'
import { addProfileUpdater } from '../core/profileUpdater'
import { readFile, rm, writeFile } from 'fs/promises'
import { restartCore } from '../core/manager'
import { getAppConfig } from './app'
import { mainWindow } from '..'
import { existsSync } from 'fs'
import axios from 'axios'
import yaml from 'yaml'
import { defaultProfile } from '../utils/template'

let profileConfig: IProfileConfig // profile.yaml

export async function getProfileConfig(force = false): Promise<IProfileConfig> {
  if (force || !profileConfig) {
    const data = await readFile(profileConfigPath(), 'utf-8')
    profileConfig = yaml.parse(data)
  }
  return profileConfig
}

export async function setProfileConfig(config: IProfileConfig): Promise<void> {
  profileConfig = config
  mainWindow?.webContents.send('profileConfigUpdated')
  await writeFile(profileConfigPath(), yaml.stringify(config), 'utf-8')
}

export async function getProfileItem(id: string | undefined): Promise<IProfileItem | undefined> {
  const { items } = await getProfileConfig()
  if (!id || id === 'default') return { id: 'default', type: 'local', name: '空白订阅' }
  return items.find((item) => item.id === id)
}

export async function changeCurrentProfile(id: string): Promise<void> {
  const config = await getProfileConfig()
  const current = config.current
  config.current = id
  await setProfileConfig(config)
  try {
    await restartCore()
  } catch (e) {
    config.current = current
    throw e
  } finally {
    await setProfileConfig(config)
  }
}

export async function updateProfileItem(item: IProfileItem): Promise<void> {
  const config = await getProfileConfig()
  const index = config.items.findIndex((i) => i.id === item.id)
  if (index === -1) {
    throw new Error('Profile not found')
  }
  config.items[index] = item
  await setProfileConfig(config)
  await addProfileUpdater(item)
}

export async function addProfileItem(item: Partial<IProfileItem>): Promise<void> {
  const newItem = await createProfile(item)
  const config = await getProfileConfig()
  if (await getProfileItem(item.id)) {
    await updateProfileItem(newItem)
  } else {
    config.items.push(newItem)
  }
  await setProfileConfig(config)

  if (!config.current) {
    await changeCurrentProfile(newItem.id)
  }
  await addProfileUpdater(newItem)
}

export async function removeProfileItem(id: string): Promise<void> {
  const config = await getProfileConfig()
  config.items = config.items?.filter((item) => item.id !== id)
  if (config.current === id) {
    if (config.items.length > 0) {
      config.current = config.items[0].id
    } else {
      config.current = undefined
    }
  }
  await setProfileConfig(config)
  if (existsSync(profilePath(id))) {
    await rm(profilePath(id))
  }
}

export async function getCurrentProfileItem(): Promise<IProfileItem> {
  const { current } = await getProfileConfig()
  return (await getProfileItem(current)) || { id: 'default', type: 'local', name: '空白订阅' }
}

export async function createProfile(item: Partial<IProfileItem>): Promise<IProfileItem> {
  const id = item.id || new Date().getTime().toString(16)
  const newItem = {
    id,
    name: item.name || (item.type === 'remote' ? 'Remote File' : 'Local File'),
    type: item.type,
    url: item.url,
    interval: item.interval || 0,
    updated: new Date().getTime()
  } as IProfileItem
  switch (newItem.type) {
    case 'remote': {
      const { userAgent = 'clash-meta' } = await getAppConfig()
      const { 'mixed-port': mixedPort = 7890 } = await getControledMihomoConfig()
      if (!item.url) throw new Error('Empty URL')
      const res = await axios.get(item.url, {
        proxy: {
          protocol: 'http',
          host: '127.0.0.1',
          port: mixedPort
        },
        headers: {
          'User-Agent': userAgent
        }
      })
      const data = res.data
      const headers = res.headers
      if (headers['content-disposition'] && newItem.name === 'Remote File') {
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
      await setProfileStr(id, data)
      break
    }
    case 'local': {
      const data = item.file || ''
      await setProfileStr(id, data)
      break
    }
  }
  return newItem
}

export async function getProfileStr(id: string | undefined): Promise<string> {
  if (existsSync(profilePath(id || 'default'))) {
    return await readFile(profilePath(id || 'default'), 'utf-8')
  } else {
    return yaml.stringify(defaultProfile)
  }
}

export async function setProfileStr(id: string, content: string): Promise<void> {
  const { current } = await getProfileConfig()
  await writeFile(profilePath(id), content, 'utf-8')
  if (current === id) await restartCore()
}

export async function getProfile(id: string | undefined): Promise<IMihomoConfig> {
  const profile = await getProfileStr(id)
  return yaml.parse(profile)
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
