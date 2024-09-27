import net from 'net'
import { getRuntimeConfig } from './factory'
import { getAppConfig, getControledMihomoConfig } from '../config'
import { mainWindow } from '..'
import { tray } from '../resolve/tray'
import { calcTraffic } from '../utils/calc'
import { join } from 'path'
import { mihomoWorkDir } from '../utils/dirs'

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

let mihomoTrafficWs: net.Socket | null = null
let trafficRetry = 10
let mihomoMemoryWs: net.Socket | null = null
let memoryRetry = 10
let mihomoLogsWs: net.Socket | null = null
let logsRetry = 10
let mihomoConnectionsWs: net.Socket | null = null
let connectionsRetry = 10

function trimJson(data: string): string {
  if (data.trim().length === 0) return ''
  const start = data.indexOf('{')
  const end = data.lastIndexOf('}')
  return data.slice(start, end + 1)
}

async function mihomoHttp<T>(method: HttpMethod, path: string, data?: object): Promise<T> {
  const {
    'external-controller-pipe': mihomoPipe = '\\\\.\\pipe\\MihomoParty\\mihomo',
    'external-controller-unix': mihomoUnix = 'mihomo-party.sock'
  } = await getControledMihomoConfig()
  return new Promise((resolve, reject) => {
    const client = net.connect(
      process.platform === 'win32' ? mihomoPipe : join(mihomoWorkDir(), mihomoUnix)
    )
    client.on('data', function (res) {
      try {
        const data = res.toString().split('\r\n\r\n')[1]
        const json = trimJson(data)
        if (res.toString().includes('HTTP/1.1 4') || res.toString().includes('HTTP/1.1 5')) {
          reject(json ? JSON.parse(json) : data)
        } else {
          resolve(json ? JSON.parse(json) : undefined)
        }
      } catch (e) {
        reject(e)
      } finally {
        client.end()
      }
    })
    client.on('error', function (error) {
      reject(error)
    })
    if (data) {
      const json = JSON.stringify(data)
      client.write(
        `${method} ${path} HTTP/1.1\r\nHost: mihomo-party\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.from(json).length}\r\n\r\n${json}`
      )
    } else {
      client.write(`${method} ${path} HTTP/1.1\r\nHost: mihomo-party\r\n\r\n`)
    }
  })
}

async function mihomoWs(path: string): Promise<net.Socket> {
  const {
    'external-controller-pipe': mihomoPipe = '\\\\.\\pipe\\MihomoParty\\mihomo',
    'external-controller-unix': mihomoUnix = 'mihomo-party.sock'
  } = await getControledMihomoConfig()
  const client = net.connect(
    process.platform === 'win32' ? mihomoPipe : join(mihomoWorkDir(), mihomoUnix)
  )
  client.write(
    `GET ${path} HTTP/1.1\r\nHost: mihomo-party\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: xxxxxxxxxxxxxxxxxxxxxxxx\r\n\r\n`
  )

  return client
}

export const mihomoVersion = async (): Promise<IMihomoVersion> => {
  return await mihomoHttp('GET', '/version')
}

export const patchMihomoConfig = async (patch: Partial<IMihomoConfig>): Promise<void> => {
  return await mihomoHttp('PATCH', '/configs', patch)
}

export const mihomoCloseConnection = async (id: string): Promise<void> => {
  return await mihomoHttp('DELETE', `/connections/${id}`)
}

export const mihomoCloseAllConnections = async (): Promise<void> => {
  return await mihomoHttp('DELETE', '/connections')
}

export const mihomoRules = async (): Promise<IMihomoRulesInfo> => {
  return await mihomoHttp('GET', '/rules')
}

export const mihomoProxies = async (): Promise<IMihomoProxies> => {
  const proxies = (await mihomoHttp('GET', '/proxies')) as IMihomoProxies
  if (!proxies.proxies['GLOBAL']) {
    throw new Error('GLOBAL proxy not found')
  }
  return proxies
}

export const mihomoGroups = async (): Promise<IMihomoMixedGroup[]> => {
  const proxies = await mihomoProxies()
  const runtime = await getRuntimeConfig()
  const groups: IMihomoMixedGroup[] = []
  runtime?.['proxy-groups']?.forEach((group: { name: string; url?: string }) => {
    const { name, url } = group
    if (proxies.proxies[name] && 'all' in proxies.proxies[name] && !proxies.proxies[name].hidden) {
      const newGroup = proxies.proxies[name]
      newGroup.testUrl = url
      const newAll = newGroup.all.map((name) => proxies.proxies[name])
      groups.push({ ...newGroup, all: newAll })
    }
  })
  if (!groups.find((group) => group.name === 'GLOBAL')) {
    const newGlobal = proxies.proxies['GLOBAL'] as IMihomoGroup
    if (!newGlobal.hidden) {
      const newAll = newGlobal.all.map((name) => proxies.proxies[name])
      groups.push({ ...newGlobal, all: newAll })
    }
  }
  return groups
}

export const mihomoProxyProviders = async (): Promise<IMihomoProxyProviders> => {
  return await mihomoHttp('GET', '/providers/proxies')
}

export const mihomoUpdateProxyProviders = async (name: string): Promise<void> => {
  return await mihomoHttp('PUT', `/providers/proxies/${encodeURIComponent(name)}`)
}

export const mihomoRuleProviders = async (): Promise<IMihomoRuleProviders> => {
  return await mihomoHttp('GET', '/providers/rules')
}

export const mihomoUpdateRuleProviders = async (name: string): Promise<void> => {
  return await mihomoHttp('PUT', `/providers/rules/${encodeURIComponent(name)}`)
}

export const mihomoChangeProxy = async (group: string, proxy: string): Promise<IMihomoProxy> => {
  return await mihomoHttp('PUT', `/proxies/${encodeURIComponent(group)}`, { name: proxy })
}

export const mihomoUpgradeGeo = async (): Promise<void> => {
  return await mihomoHttp('POST', '/configs/geo')
}

export const mihomoProxyDelay = async (proxy: string, url?: string): Promise<IMihomoDelay> => {
  const appConfig = await getAppConfig()
  const { delayTestUrl, delayTestTimeout } = appConfig

  return await mihomoHttp(
    'GET',
    `/proxies/${encodeURIComponent(proxy)}/delay?url=${encodeURIComponent(url || delayTestUrl || 'https://www.gstatic.com/generate_204')}&timeout=${delayTestTimeout || 5000}`
  )
}

export const mihomoGroupDelay = async (group: string, url?: string): Promise<IMihomoGroupDelay> => {
  const appConfig = await getAppConfig()
  const { delayTestUrl, delayTestTimeout } = appConfig
  return await mihomoHttp(
    'GET',
    `/proxies/${encodeURIComponent(group)}/delay?url=${encodeURIComponent(url || delayTestUrl || 'https://www.gstatic.com/generate_204')}&timeout=${delayTestTimeout || 5000}`
  )
}

export const mihomoUpgrade = async (): Promise<void> => {
  return await mihomoHttp('POST', '/upgrade')
}

export const startMihomoTraffic = async (): Promise<void> => {
  await mihomoTraffic()
}

export const stopMihomoTraffic = async (): Promise<void> => {
  if (mihomoTrafficWs) {
    mihomoTrafficWs.end()
    mihomoTrafficWs = null
  }
}

const mihomoTraffic = async (): Promise<void> => {
  stopMihomoTraffic()
  mihomoTrafficWs = await mihomoWs('/traffic')
  mihomoTrafficWs.on('data', (data) => {
    try {
      const json = JSON.parse(trimJson(data.toString())) as IMihomoTrafficInfo
      trafficRetry = 10
      mainWindow?.webContents.send('mihomoTraffic', json)
      tray?.setToolTip(
        '↑' +
          `${calcTraffic(json.up)}/s`.padStart(9) +
          '\n↓' +
          `${calcTraffic(json.down)}/s`.padStart(9)
      )
    } catch {
      // ignore
    }
  })
  mihomoTrafficWs.on('close', () => {
    if (trafficRetry) {
      trafficRetry--
      mihomoTraffic()
    }
  })

  mihomoTrafficWs.on('error', (): void => {
    stopMihomoTraffic()
  })
}

export const startMihomoMemory = async (): Promise<void> => {
  await mihomoMemory()
}

export const stopMihomoMemory = async (): Promise<void> => {
  if (mihomoMemoryWs) {
    mihomoMemoryWs.end()
    mihomoMemoryWs = null
  }
}

const mihomoMemory = async (): Promise<void> => {
  stopMihomoMemory()
  mihomoMemoryWs = await mihomoWs('/memory')
  mihomoMemoryWs.on('data', (data) => {
    try {
      const json = JSON.parse(trimJson(data.toString())) as IMihomoMemoryInfo
      memoryRetry = 10
      mainWindow?.webContents.send('mihomoMemory', json)
    } catch {
      // ignore
    }
  })
  mihomoMemoryWs.on('close', () => {
    if (memoryRetry) {
      memoryRetry--
      mihomoMemory()
    }
  })

  mihomoMemoryWs.on('error', (): void => {
    stopMihomoMemory()
  })
}

export const startMihomoLogs = async (): Promise<void> => {
  await mihomoLogs()
}

export const stopMihomoLogs = async (): Promise<void> => {
  if (mihomoLogsWs) {
    mihomoLogsWs.end()
    mihomoLogsWs = null
  }
}

const mihomoLogs = async (): Promise<void> => {
  stopMihomoLogs()
  mihomoLogsWs = await mihomoWs('/logs')
  mihomoLogsWs.on('data', (data) => {
    try {
      const json = JSON.parse(trimJson(data.toString())) as IMihomoLogInfo
      logsRetry = 10
      mainWindow?.webContents.send('mihomoLogs', json)
    } catch {
      // ignore
    }
  })
  mihomoLogsWs.on('close', () => {
    if (logsRetry) {
      logsRetry--
      mihomoLogs()
    }
  })

  mihomoLogsWs.on('error', (): void => {
    stopMihomoLogs()
  })
}

export const startMihomoConnections = async (): Promise<void> => {
  await mihomoConnections()
}

export const stopMihomoConnections = async (): Promise<void> => {
  if (mihomoConnectionsWs) {
    mihomoConnectionsWs.end()
    mihomoConnectionsWs = null
  }
}

const mihomoConnections = async (): Promise<void> => {
  stopMihomoConnections()
  mihomoConnectionsWs = await mihomoWs('/connections')
  mihomoConnectionsWs.on('data', (data) => {
    try {
      const json = JSON.parse(trimJson(data.toString())) as IMihomoConnectionsInfo
      connectionsRetry = 10
      mainWindow?.webContents.send('mihomoConnections', json)
    } catch {
      // ignore
    }
  })
  mihomoConnectionsWs.on('close', () => {
    if (connectionsRetry) {
      connectionsRetry--
      mihomoConnections()
    }
  })

  mihomoConnectionsWs.on('error', (): void => {
    stopMihomoConnections()
  })
}
