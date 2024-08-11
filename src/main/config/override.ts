import { overrideConfigPath, overridePath } from '../utils/dirs'
import yaml from 'yaml'
import fs from 'fs'
import { dialog } from 'electron'
import axios from 'axios'
import { getControledMihomoConfig } from './controledMihomo'

let overrideConfig: IOverrideConfig // override.yaml

export function getOverrideConfig(force = false): IOverrideConfig {
  if (force || !overrideConfig) {
    overrideConfig = yaml.parse(fs.readFileSync(overrideConfigPath(), 'utf-8'))
  }
  return overrideConfig
}

export function setOverrideConfig(config: IOverrideConfig): void {
  overrideConfig = config
  fs.writeFileSync(overrideConfigPath(), yaml.stringify(overrideConfig))
}

export function getOverrideItem(id: string): IOverrideItem | undefined {
  return overrideConfig.items.find((item) => item.id === id)
}
export function updateOverrideItem(item: IOverrideItem): void {
  const index = overrideConfig.items.findIndex((i) => i.id === item.id)
  overrideConfig.items[index] = item
  fs.writeFileSync(overrideConfigPath(), yaml.stringify(overrideConfig))
}

export async function addOverrideItem(item: Partial<IOverrideItem>): Promise<void> {
  const newItem = await createOverride(item)
  if (overrideConfig.items.find((i) => i.id === newItem.id)) {
    updateOverrideItem(newItem)
  } else {
    overrideConfig.items.push(newItem)
  }
  fs.writeFileSync(overrideConfigPath(), yaml.stringify(overrideConfig))
}

export function removeOverrideItem(id: string): void {
  overrideConfig.items = overrideConfig.items?.filter((item) => item.id !== id)
  fs.writeFileSync(overrideConfigPath(), yaml.stringify(overrideConfig))
  fs.rmSync(overridePath(id))
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
      if (!item.url) {
        dialog.showErrorBox(
          'URL is required for remote script',
          'URL is required for remote script'
        )
        throw new Error('URL is required for remote script')
      }
      try {
        const res = await axios.get(item.url, {
          proxy: {
            protocol: 'http',
            host: '127.0.0.1',
            port: getControledMihomoConfig()['mixed-port'] || 7890
          },
          responseType: 'text'
        })
        const data = res.data
        setOverride(id, data)
      } catch (e) {
        dialog.showErrorBox('Failed to fetch remote script', `${e}\nurl: ${item.url}`)
        throw new Error(`Failed to fetch remote script ${e}`)
      }
      break
    }
    case 'local': {
      if (!item.file) {
        dialog.showErrorBox(
          'File is required for local script',
          'File is required for local script'
        )
        throw new Error('File is required for local script')
      }
      const data = item.file
      setOverride(id, data)
      break
    }
  }

  return newItem
}

export function getOverride(id: string): string {
  if (!fs.existsSync(overridePath(id))) {
    return `function main(config){ return config }`
  }
  return fs.readFileSync(overridePath(id), 'utf-8')
}

export function setOverride(id: string, content: string): void {
  fs.writeFileSync(overridePath(id), content, 'utf-8')
}
