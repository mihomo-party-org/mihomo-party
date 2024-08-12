import axios, { AxiosInstance } from 'axios'
import { getAppConfig, getControledMihomoConfig } from '../config'
import WebSocket from 'ws'
import { window } from '..'

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

  let server = getControledMihomoConfig()['external-controller']
  const secret = getControledMihomoConfig().secret ?? ''
  if (server?.startsWith(':')) server = `127.0.0.1${server}`

  axiosIns = axios.create({
    baseURL: `http://${server}`,
    proxy: false,
    headers: secret ? { Authorization: `Bearer ${secret}` } : {},
    timeout: 15000
  })
  axiosIns.interceptors.response.use((r) => r.data)
  return axiosIns
}

export async function mihomoVersion(): Promise<IMihomoVersion> {
  const instance = await getAxios()
  return (await instance.get('/version').catch(() => {
    return { version: '-' }
  })) as IMihomoVersion
}

export const patchMihomoConfig = async (patch: Partial<IMihomoConfig>): Promise<void> => {
  const instance = await getAxios()
  return (await instance.patch('/configs', patch).catch((e) => {
    return e.response.data
  })) as Promise<void>
}

export const mihomoCloseConnection = async (id: string): Promise<void> => {
  const instance = await getAxios()
  return (await instance.delete(`/connections/${encodeURIComponent(id)}`).catch((e) => {
    return e.response.data
  })) as Promise<void>
}

export const mihomoCloseAllConnections = async (): Promise<void> => {
  const instance = await getAxios()
  return (await instance.delete('/connections').catch((e) => {
    return e.response.data
  })) as Promise<void>
}

export const mihomoRules = async (): Promise<IMihomoRulesInfo> => {
  const instance = await getAxios()
  return (await instance.get('/rules').catch(() => {
    return { rules: [] }
  })) as IMihomoRulesInfo
}

export const mihomoProxies = async (): Promise<IMihomoProxies> => {
  const instance = await getAxios()
  return (await instance.get('/proxies').catch(() => {
    return { proxies: {} }
  })) as IMihomoProxies
}

export const mihomoProxyProviders = async (): Promise<IMihomoProxyProviders> => {
  const instance = await getAxios()
  return (await instance.get('/providers/proxies').catch(() => {
    return { providers: {} }
  })) as IMihomoProxyProviders
}

export const mihomoUpdateProxyProviders = async (name: string): Promise<void> => {
  const instance = await getAxios()
  return instance.put(`/providers/proxies/${encodeURIComponent(name)}`).catch((e) => {
    return e.response.data
  })
}

export const mihomoRuleProviders = async (): Promise<IMihomoRuleProviders> => {
  const instance = await getAxios()
  return (await instance.get('/providers/rules').catch(() => {
    return { providers: {} }
  })) as IMihomoRuleProviders
}

export const mihomoUpdateRuleProviders = async (name: string): Promise<void> => {
  const instance = await getAxios()
  return instance.put(`/providers/rules/${encodeURIComponent(name)}`).catch((e) => {
    return e.response.data
  })
}

export const mihomoChangeProxy = async (group: string, proxy: string): Promise<IMihomoProxy> => {
  const instance = await getAxios()
  return (await instance.put(`/proxies/${encodeURIComponent(group)}`, { name: proxy }).catch(() => {
    return {
      alive: false,
      extra: {},
      history: [],
      id: '',
      name: '',
      tfo: false,
      type: 'Shadowsocks',
      udp: false,
      xudp: false
    }
  })) as IMihomoProxy
}

export const mihomoUpgradeGeo = async (): Promise<void> => {
  const instance = await getAxios()
  return instance.post('/configs/geo').catch((e) => {
    return e.response.data
  })
}

export const mihomoProxyDelay = async (proxy: string, url?: string): Promise<IMihomoDelay> => {
  const appConfig = getAppConfig()
  const { delayTestUrl, delayTestTimeout } = appConfig
  const instance = await getAxios()
  return (await instance
    .get(`/proxies/${encodeURIComponent(proxy)}/delay`, {
      params: {
        url: url || delayTestUrl || 'https://www.gstatic.com/generate_204',
        timeout: delayTestTimeout || 5000
      }
    })
    .catch((e) => {
      return e.response.data
    })) as IMihomoDelay
}

export const mihomoGroupDelay = async (group: string, url?: string): Promise<IMihomoGroupDelay> => {
  const appConfig = getAppConfig()
  const { delayTestUrl, delayTestTimeout } = appConfig
  const instance = await getAxios()
  return (await instance
    .get(`/group/${encodeURIComponent(group)}/delay`, {
      params: {
        url: url || delayTestUrl || 'https://www.gstatic.com/generate_204',
        timeout: delayTestTimeout || 5000
      }
    })
    .catch((e) => {
      return e.response.data
    })) as IMihomoGroupDelay
}

export const startMihomoTraffic = (): void => {
  mihomoTraffic()
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

const mihomoTraffic = (): void => {
  let server = getControledMihomoConfig()['external-controller']
  const secret = getControledMihomoConfig().secret ?? ''
  if (server?.startsWith(':')) server = `127.0.0.1${server}`
  stopMihomoTraffic()

  mihomoTrafficWs = new WebSocket(`ws://${server}/traffic?token=${encodeURIComponent(secret)}`)

  mihomoTrafficWs.onmessage = (e): void => {
    const data = e.data as string
    trafficRetry = 10
    window?.webContents.send('mihomoTraffic', JSON.parse(data) as IMihomoTrafficInfo)
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

export const startMihomoMemory = (): void => {
  mihomoMemory()
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

const mihomoMemory = (): void => {
  let server = getControledMihomoConfig()['external-controller']
  const secret = getControledMihomoConfig().secret ?? ''
  if (server?.startsWith(':')) server = `127.0.0.1${server}`
  stopMihomoMemory()

  mihomoMemoryWs = new WebSocket(`ws://${server}/memory?token=${encodeURIComponent(secret)}`)

  mihomoMemoryWs.onmessage = (e): void => {
    const data = e.data as string
    memoryRetry = 10
    window?.webContents.send('mihomoMemory', JSON.parse(data) as IMihomoMemoryInfo)
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

export const startMihomoLogs = (): void => {
  mihomoLogs()
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

const mihomoLogs = (): void => {
  const { secret = '', 'log-level': level = 'info' } = getControledMihomoConfig()
  let { 'external-controller': server } = getControledMihomoConfig()
  if (server?.startsWith(':')) server = `127.0.0.1${server}`
  stopMihomoLogs()

  mihomoLogsWs = new WebSocket(
    `ws://${server}/logs?token=${encodeURIComponent(secret)}&level=${level}`
  )

  mihomoLogsWs.onmessage = (e): void => {
    const data = e.data as string
    logsRetry = 10
    window?.webContents.send('mihomoLogs', JSON.parse(data) as IMihomoLogInfo)
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

export const startMihomoConnections = (): void => {
  mihomoConnections()
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

const mihomoConnections = (): void => {
  let server = getControledMihomoConfig()['external-controller']
  const secret = getControledMihomoConfig().secret ?? ''
  if (server?.startsWith(':')) server = `127.0.0.1${server}`
  stopMihomoConnections()

  mihomoConnectionsWs = new WebSocket(
    `ws://${server}/connections?token=${encodeURIComponent(secret)}`
  )

  mihomoConnectionsWs.onmessage = (e): void => {
    const data = e.data as string
    connectionsRetry = 10
    window?.webContents.send('mihomoConnections', JSON.parse(data) as IMihomoConnectionsInfo)
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

export const pauseWebsockets = () => {
  const recoverList: (() => void)[] = []
  if (mihomoTrafficWs) {
    stopMihomoTraffic()
    recoverList.push(startMihomoTraffic)
  }
  if (mihomoMemoryWs) {
    stopMihomoMemory()
    recoverList.push(startMihomoMemory)
  }
  if (mihomoLogsWs) {
    stopMihomoLogs()
    recoverList.push(startMihomoLogs)
  }
  if (mihomoConnectionsWs) {
    stopMihomoConnections()
    recoverList.push(startMihomoConnections)
  }
  return (): void => {
    recoverList.forEach((recover) => recover())
  }
}
