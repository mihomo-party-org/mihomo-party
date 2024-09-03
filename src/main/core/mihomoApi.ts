import axios, { AxiosInstance } from 'axios'
import { getAppConfig, getControledMihomoConfig } from '../config'
import { mainWindow } from '..'
import WebSocket from 'ws'
import { tray } from '../resolve/tray'
import { calcTraffic } from '../utils/calc'
import { getRuntimeConfig } from './factory'

let axiosIns: AxiosInstance = null!
let mihomoTrafficWs: WebSocket | null = null
let trafficRetry = 10
let mihomoMemoryWs: WebSocket | null = null
let memoryRetry = 10
let mihomoLogsWs: WebSocket | null = null
let logsRetry = 10
let mihomoConnectionsWs: WebSocket | null = null
let connectionsRetry = 10

export const getAxios = async (force: boolean = false): Promise<AxiosInstance> => {
  if (axiosIns && !force) return axiosIns
  const controledMihomoConfig = await getControledMihomoConfig()
  let server = controledMihomoConfig['external-controller']
  const secret = controledMihomoConfig.secret ?? ''
  if (server?.startsWith(':')) server = `127.0.0.1${server}`

  axiosIns = axios.create({
    baseURL: `http://${server}`,
    proxy: false,
    headers: secret ? { Authorization: `Bearer ${secret}` } : {},
    timeout: 15000
  })

  axiosIns.interceptors.response.use(
    (response) => {
      return response.data
    },
    (error) => {
      if (error.response && error.response.data) {
        return Promise.reject(error.response.data)
      }
      return Promise.reject(error)
    }
  )
  return axiosIns
}

export async function mihomoVersion(): Promise<IMihomoVersion> {
  const instance = await getAxios()
  return await instance.get('/version')
}

export const patchMihomoConfig = async (patch: Partial<IMihomoConfig>): Promise<void> => {
  const instance = await getAxios()
  return await instance.patch('/configs', patch)
}

export const mihomoCloseConnection = async (id: string): Promise<void> => {
  const instance = await getAxios()
  return await instance.delete(`/connections/${encodeURIComponent(id)}`)
}

export const mihomoCloseAllConnections = async (): Promise<void> => {
  const instance = await getAxios()
  return await instance.delete('/connections')
}

export const mihomoRules = async (): Promise<IMihomoRulesInfo> => {
  const instance = await getAxios()
  return await instance.get('/rules')
}

export const mihomoProxies = async (): Promise<IMihomoProxies> => {
  const instance = await getAxios()
  const proxies = (await instance.get('/proxies')) as IMihomoProxies
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
    group = Object.assign(group, group['<<'])
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
    const newAll = newGlobal.all.map((name) => proxies.proxies[name])
    groups.push({ ...newGlobal, all: newAll })
  }
  return groups
}

export const mihomoProxyProviders = async (): Promise<IMihomoProxyProviders> => {
  const instance = await getAxios()
  return await instance.get('/providers/proxies')
}

export const mihomoUpdateProxyProviders = async (name: string): Promise<void> => {
  const instance = await getAxios()
  return await instance.put(`/providers/proxies/${encodeURIComponent(name)}`)
}

export const mihomoRuleProviders = async (): Promise<IMihomoRuleProviders> => {
  const instance = await getAxios()
  return await instance.get('/providers/rules')
}

export const mihomoUpdateRuleProviders = async (name: string): Promise<void> => {
  const instance = await getAxios()
  return await instance.put(`/providers/rules/${encodeURIComponent(name)}`)
}

export const mihomoChangeProxy = async (group: string, proxy: string): Promise<IMihomoProxy> => {
  const instance = await getAxios()
  return await instance.put(`/proxies/${encodeURIComponent(group)}`, { name: proxy })
}

export const mihomoUpgradeGeo = async (): Promise<void> => {
  const instance = await getAxios()
  return await instance.post('/configs/geo')
}

export const mihomoProxyDelay = async (proxy: string, url?: string): Promise<IMihomoDelay> => {
  const appConfig = await getAppConfig()
  const { delayTestUrl, delayTestTimeout } = appConfig
  const instance = await getAxios()
  return await instance.get(`/proxies/${encodeURIComponent(proxy)}/delay`, {
    params: {
      url: url || delayTestUrl || 'https://www.gstatic.com/generate_204',
      timeout: delayTestTimeout || 5000
    }
  })
}

export const mihomoGroupDelay = async (group: string, url?: string): Promise<IMihomoGroupDelay> => {
  const appConfig = await getAppConfig()
  const { delayTestUrl, delayTestTimeout } = appConfig
  const instance = await getAxios()
  return await instance.get(`/group/${encodeURIComponent(group)}/delay`, {
    params: {
      url: url || delayTestUrl || 'https://www.gstatic.com/generate_204',
      timeout: delayTestTimeout || 5000
    }
  })
}

export const mihomoUpgrade = async (): Promise<void> => {
  const instance = await getAxios()
  return await instance.post('/upgrade')
}

export const startMihomoTraffic = async (): Promise<void> => {
  await mihomoTraffic()
}

export const stopMihomoTraffic = (): void => {
  if (mihomoTrafficWs) {
    mihomoTrafficWs.removeAllListeners()
    if (mihomoTrafficWs.readyState === WebSocket.OPEN) {
      mihomoTrafficWs.close()
    }
    mihomoTrafficWs = null
  }
}

const mihomoTraffic = async (): Promise<void> => {
  const controledMihomoConfig = await getControledMihomoConfig()
  let server = controledMihomoConfig['external-controller']
  const secret = controledMihomoConfig.secret ?? ''
  if (server?.startsWith(':')) server = `127.0.0.1${server}`
  stopMihomoTraffic()

  mihomoTrafficWs = new WebSocket(`ws://${server}/traffic?token=${encodeURIComponent(secret)}`)

  mihomoTrafficWs.onmessage = async (e): Promise<void> => {
    const data = e.data as string
    const json = JSON.parse(data) as IMihomoTrafficInfo
    trafficRetry = 10
    mainWindow?.webContents.send('mihomoTraffic', json)
    if (process.platform !== 'linux') {
      tray?.setToolTip(
        '↑' +
          `${calcTraffic(json.up)}/s`.padStart(9) +
          '\n↓' +
          `${calcTraffic(json.down)}/s`.padStart(9)
      )
    }
  }

  mihomoTrafficWs.onclose = (): void => {
    if (trafficRetry) {
      trafficRetry--
      mihomoTraffic()
    }
  }

  mihomoTrafficWs.onerror = (): void => {
    if (mihomoTrafficWs) {
      mihomoTrafficWs.close()
      mihomoTrafficWs = null
    }
  }
}

export const startMihomoMemory = async (): Promise<void> => {
  await mihomoMemory()
}

export const stopMihomoMemory = (): void => {
  if (mihomoMemoryWs) {
    mihomoMemoryWs.removeAllListeners()
    if (mihomoMemoryWs.readyState === WebSocket.OPEN) {
      mihomoMemoryWs.close()
    }
    mihomoMemoryWs = null
  }
}

const mihomoMemory = async (): Promise<void> => {
  const controledMihomoConfig = await getControledMihomoConfig()
  let server = controledMihomoConfig['external-controller']
  const secret = controledMihomoConfig.secret ?? ''
  if (server?.startsWith(':')) server = `127.0.0.1${server}`
  stopMihomoMemory()

  mihomoMemoryWs = new WebSocket(`ws://${server}/memory?token=${encodeURIComponent(secret)}`)

  mihomoMemoryWs.onmessage = (e): void => {
    const data = e.data as string
    memoryRetry = 10
    mainWindow?.webContents.send('mihomoMemory', JSON.parse(data) as IMihomoMemoryInfo)
  }

  mihomoMemoryWs.onclose = (): void => {
    if (memoryRetry) {
      memoryRetry--
      mihomoMemory()
    }
  }

  mihomoMemoryWs.onerror = (): void => {
    if (mihomoMemoryWs) {
      mihomoMemoryWs.close()
      mihomoMemoryWs = null
    }
  }
}

export const startMihomoLogs = async (): Promise<void> => {
  await mihomoLogs()
}

export const stopMihomoLogs = (): void => {
  if (mihomoLogsWs) {
    mihomoLogsWs.removeAllListeners()
    if (mihomoLogsWs.readyState === WebSocket.OPEN) {
      mihomoLogsWs.close()
    }
    mihomoLogsWs = null
  }
}

const mihomoLogs = async (): Promise<void> => {
  const controledMihomoConfig = await getControledMihomoConfig()
  const { secret = '', 'log-level': level = 'info' } = controledMihomoConfig
  let { 'external-controller': server } = controledMihomoConfig
  if (server?.startsWith(':')) server = `127.0.0.1${server}`
  stopMihomoLogs()

  mihomoLogsWs = new WebSocket(
    `ws://${server}/logs?token=${encodeURIComponent(secret)}&level=${level}`
  )

  mihomoLogsWs.onmessage = (e): void => {
    const data = e.data as string
    logsRetry = 10
    mainWindow?.webContents.send('mihomoLogs', JSON.parse(data) as IMihomoLogInfo)
  }

  mihomoLogsWs.onclose = (): void => {
    if (logsRetry) {
      logsRetry--
      mihomoLogs()
    }
  }

  mihomoLogsWs.onerror = (): void => {
    if (mihomoLogsWs) {
      mihomoLogsWs.close()
      mihomoLogsWs = null
    }
  }
}

export const startMihomoConnections = async (): Promise<void> => {
  await mihomoConnections()
}

export const stopMihomoConnections = (): void => {
  if (mihomoConnectionsWs) {
    mihomoConnectionsWs.removeAllListeners()
    if (mihomoConnectionsWs.readyState === WebSocket.OPEN) {
      mihomoConnectionsWs.close()
    }
    mihomoConnectionsWs = null
  }
}

const mihomoConnections = async (): Promise<void> => {
  const controledMihomoConfig = await getControledMihomoConfig()
  let server = controledMihomoConfig['external-controller']
  const secret = controledMihomoConfig.secret ?? ''
  if (server?.startsWith(':')) server = `127.0.0.1${server}`
  stopMihomoConnections()

  mihomoConnectionsWs = new WebSocket(
    `ws://${server}/connections?token=${encodeURIComponent(secret)}`
  )

  mihomoConnectionsWs.onmessage = (e): void => {
    const data = e.data as string
    connectionsRetry = 10
    mainWindow?.webContents.send('mihomoConnections', JSON.parse(data) as IMihomoConnectionsInfo)
  }

  mihomoConnectionsWs.onclose = (): void => {
    if (connectionsRetry) {
      connectionsRetry--
      mihomoConnections()
    }
  }

  mihomoConnectionsWs.onerror = (): void => {
    if (mihomoConnectionsWs) {
      mihomoConnectionsWs.close()
      mihomoConnectionsWs = null
    }
  }
}
