import { readFile, rm } from 'fs/promises'
import { existsSync } from 'fs'
import { overrideConfigPath, overridePath } from '../utils/dirs'
import * as chromeRequest from '../utils/chromeRequest'
import { parse, stringify } from '../utils/yaml'
import { atomicWriteFile } from '../utils/safeFile'
import { DEFAULT_MIHOMO_PORTS } from '../../shared/appConfig'
import { getControledMihomoConfig } from './controledMihomo'
import { runtimeConfigWriteQueue } from './runtimeConfigQueue'

let overrideConfig: IOverrideConfig // override.yaml
// 每次经写队列提交的写入 +1：一次迟到的冷加载 / 强制读取不得用旧内容覆盖比它新的缓存（与 profile.ts 同型）
let overrideConfigVersion = 0
// 与 profile.yaml 共用（见 runtimeConfigQueue.ts）
const overrideConfigWriteQueue = runtimeConfigWriteQueue

// Legacy YAML can contain numeric IDs (including .inf). Convert them before
// JSON cloning turns non-finite numbers into null, breaking the sortable UI.
function normalizeOverrideIds(config: IOverrideConfig): IOverrideConfig {
  if (Array.isArray(config.items)) {
    config.items = config.items.map((item) =>
      item && typeof item.id === 'number' ? { ...item, id: String(item.id) } : item
    )
  }
  return config
}

export async function getOverrideConfig(force = false): Promise<IOverrideConfig> {
  if (force || !overrideConfig) {
    const seen = overrideConfigVersion
    const data = await readFile(overrideConfigPath(), 'utf-8')
    const loaded = (parse(data) || { items: [] }) as IOverrideConfig
    // 读取期间有写入提交：磁盘与缓存都已比这次读取新，保留缓存
    if (overrideConfigVersion === seen || !overrideConfig) overrideConfig = loaded
  }
  if (typeof overrideConfig !== 'object') overrideConfig = { items: [] }
  if (!Array.isArray(overrideConfig.items)) overrideConfig.items = []
  return JSON.parse(JSON.stringify(normalizeOverrideIds(overrideConfig))) as IOverrideConfig
}

export async function setOverrideConfig(config: IOverrideConfig): Promise<void> {
  await overrideConfigWriteQueue.run(async () => {
    const nextConfig = JSON.parse(JSON.stringify(normalizeOverrideIds(config))) as IOverrideConfig
    await atomicWriteFile(overrideConfigPath(), stringify(nextConfig), { encoding: 'utf8' })
    overrideConfig = nextConfig
    overrideConfigVersion++
  })
}

// 在写队列内部重新读取后再修改，避免「队列外读快照 → 长时间 await → 整体写回」吞掉并发修改
export async function updateOverrideConfig(
  updater: (config: IOverrideConfig) => IOverrideConfig
): Promise<void> {
  await overrideConfigWriteQueue.run(async () => {
    const data = await readFile(overrideConfigPath(), 'utf-8')
    const currentConfig = (parse(data) || { items: [] }) as IOverrideConfig
    if (typeof currentConfig !== 'object') {
      throw new Error('Override config is invalid')
    }
    if (!Array.isArray(currentConfig.items)) currentConfig.items = []
    const nextConfig = updater(
      JSON.parse(JSON.stringify(normalizeOverrideIds(currentConfig))) as IOverrideConfig
    )
    await atomicWriteFile(overrideConfigPath(), stringify(nextConfig), { encoding: 'utf8' })
    overrideConfig = nextConfig
    overrideConfigVersion++
  })
}

export async function getOverrideItem(id: string | undefined): Promise<IOverrideItem | undefined> {
  const { items } = await getOverrideConfig()
  return items.find((item) => item.id === id)
}

export async function updateOverrideItem(item: IOverrideItem): Promise<void> {
  await updateOverrideConfig((config) => {
    const index = config.items.findIndex((i) => i.id === item.id)
    if (index === -1) {
      throw new Error('Override not found')
    }
    config.items[index] = item
    return config
  })
}

export async function addOverrideItem(item: Partial<IOverrideItem>): Promise<void> {
  // 先完成下载/落盘（可能耗时数秒），再进入写队列做读-改-写
  const newItem = await createOverride(item)
  await updateOverrideConfig((config) => {
    const index = config.items.findIndex((i) => i.id === newItem.id)
    if (index === -1) {
      config.items.push(newItem)
    } else {
      config.items[index] = newItem
    }
    return config
  })
}

export async function removeOverrideItem(id: string): Promise<void> {
  let removedItem: IOverrideItem | undefined
  await updateOverrideConfig((config) => {
    removedItem = config.items?.find((i) => i.id === id)
    config.items = config.items?.filter((i) => i.id !== id)
    return config
  })
  if (!removedItem) return
  if (existsSync(overridePath(id, removedItem.ext))) {
    await rm(overridePath(id, removedItem.ext))
  }
}

export async function createOverride(item: Partial<IOverrideItem>): Promise<IOverrideItem> {
  const id = item.id || new Date().getTime().toString(16)
  const newItem = {
    id,
    name: item.name || (item.type === 'remote' ? 'Remote File' : 'Local File'),
    type: item.type,
    ext: item.ext || 'js',
    url: item.url,
    global: item.global || false,
    updated: new Date().getTime()
  } as IOverrideItem
  switch (newItem.type) {
    case 'remote': {
      const { 'mixed-port': mixedPort = DEFAULT_MIHOMO_PORTS.mixed } =
        await getControledMihomoConfig()
      if (!item.url) throw new Error('Empty URL')
      // 混合端口为 0 表示代理端口已关闭，此时必须直连，否则会拼出 127.0.0.1:0 的代理
      const proxy =
        mixedPort === 0
          ? (false as const)
          : { protocol: 'http' as const, host: '127.0.0.1', port: mixedPort }
      const res = await chromeRequest.get(item.url, {
        proxy,
        responseType: 'text'
      })
      // chromeRequest 对任何状态码都会 resolve，不校验会把 404 错误页当成覆写内容写入
      if (res.status < 200 || res.status >= 300) {
        throw new Error(`Override download failed: status ${res.status}`)
      }
      const data = res.data as string
      await setOverride(id, newItem.ext, data)
      break
    }
    case 'local': {
      const data = item.file || ''
      await setOverride(id, newItem.ext, data)
      break
    }
  }

  return newItem
}

export async function getOverride(id: string, ext: 'js' | 'yaml' | 'log'): Promise<string> {
  if (!existsSync(overridePath(id, ext))) {
    return ''
  }
  return await readFile(overridePath(id, ext), 'utf-8')
}

export async function setOverride(id: string, ext: 'js' | 'yaml', content: string): Promise<void> {
  await atomicWriteFile(overridePath(id, ext), content, { encoding: 'utf8' })
}
