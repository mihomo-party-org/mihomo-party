import { overrideConfigPath, overridePath } from '../utils/dirs'
import { getControledMihomoConfig } from './controledMihomo'
import { readFile, writeFile, rm } from 'fs/promises'
import { existsSync } from 'fs'
import axios from 'axios'
import yaml from 'yaml'

let overrideConfig: IOverrideConfig // override.yaml

export async function getOverrideConfig(force = false): Promise<IOverrideConfig> {
  if (force || !overrideConfig) {
    const data = await readFile(overrideConfigPath(), 'utf-8')
    overrideConfig = yaml.parse(data)
  }
  return overrideConfig
}

export async function setOverrideConfig(config: IOverrideConfig): Promise<void> {
  overrideConfig = config
  await writeFile(overrideConfigPath(), yaml.stringify(overrideConfig), 'utf-8')
}

export async function getOverrideItem(id: string | undefined): Promise<IOverrideItem | undefined> {
  const { items } = await getOverrideConfig()
  return items.find((item) => item.id === id)
}

export async function updateOverrideItem(item: IOverrideItem): Promise<void> {
  const config = await getOverrideConfig()
  const index = config.items.findIndex((i) => i.id === item.id)
  if (index === -1) {
    throw new Error('Override not found')
  }
  config.items[index] = item
  await setOverrideConfig(config)
}

export async function addOverrideItem(item: Partial<IOverrideItem>): Promise<void> {
  const config = await getOverrideConfig()
  const newItem = await createOverride(item)
  if (await getOverrideItem(item.id)) {
    updateOverrideItem(newItem)
  } else {
    config.items.push(newItem)
  }
  await setOverrideConfig(config)
}

export async function removeOverrideItem(id: string): Promise<void> {
  const config = await getOverrideConfig()
  config.items = config.items?.filter((item) => item.id !== id)
  await setOverrideConfig(config)
  await rm(overridePath(id))
}

export async function createOverride(item: Partial<IOverrideItem>): Promise<IOverrideItem> {
  const id = item.id || new Date().getTime().toString(16)
  const newItem = {
    id,
    name: item.name || (item.type === 'remote' ? 'Remote File' : 'Local File'),
    type: item.type,
    url: item.url,
    updated: new Date().getTime()
  } as IOverrideItem
  switch (newItem.type) {
    case 'remote': {
      const { 'mixed-port': mixedPort = 7890 } = await getControledMihomoConfig()
      if (!item.url) throw new Error('Empty URL')
      const res = await axios.get(item.url, {
        proxy: {
          protocol: 'http',
          host: '127.0.0.1',
          port: mixedPort
        }
      })
      const data = res.data
      await setOverride(id, data)
      break
    }
    case 'local': {
      const data = item.file || ''
      setOverride(id, data)
      break
    }
  }

  return newItem
}

export async function getOverride(id: string): Promise<string> {
  if (!existsSync(overridePath(id))) {
    return `function main(config){ return config }`
  }
  return await readFile(overridePath(id), 'utf-8')
}

export async function setOverride(id: string, content: string): Promise<void> {
  await writeFile(overridePath(id), content, 'utf-8')
}
