import axios, { AxiosInstance } from 'axios'
import { getAppConfig, getControledMihomoConfig } from '../config'
import WebSocket from 'ws'
import { window } from '..'

let axiosIns: AxiosInstance = null!
let mihomoTrafficWs: WebSocket | null = null
let mihomoLogsWs: WebSocket | null = null

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
  return instance.get('/version') as Promise<IMihomoVersion>
}

export const mihomoConfig = async (): Promise<IMihomoConfig> => {
  const instance = await getAxios()
  return instance.get('/configs') as Promise<IMihomoConfig>
}

export const patchMihomoConfig = async (patch: Partial<IMihomoConfig>): Promise<void> => {
  const instance = await getAxios()
  return instance.patch('/configs', patch)
}

export const mihomoConnections = async (): Promise<IMihomoConnectionsInfo> => {
  const instance = await getAxios()
  return instance.get('/connections') as Promise<IMihomoConnectionsInfo>
}

export const mihomoRules = async (): Promise<IMihomoRulesInfo> => {
  const instance = await getAxios()
  return instance.get('/rules') as Promise<IMihomoRulesInfo>
}

export const mihomoProxies = async (): Promise<IMihomoProxies> => {
  const instance = await getAxios()
  return instance.get('/proxies') as Promise<IMihomoProxies>
}

export const mihomoChangeProxy = async (group: string, proxy: string): Promise<IMihomoProxy> => {
  const instance = await getAxios()
  return instance.put(`/proxies/${encodeURIComponent(group)}`, { name: proxy })
}

export const mihomoProxyDelay = async (proxy: string, url?: string): Promise<IMihomoDelay> => {
  const appConfig = getAppConfig()
  const { delayTestUrl, delayTestTimeout } = appConfig
  const instance = await getAxios()
  return instance.get(`/proxies/${encodeURIComponent(proxy)}/delay`, {
    params: {
      url: url || delayTestUrl || 'https://www.gstatic.com/generate_204',
      timeout: delayTestTimeout || 5000
    },
    timeout: delayTestTimeout || 5000
  })
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

  mihomoTrafficWs = new WebSocket(`ws://${server}/traffic?secret=${secret}`)

  mihomoTrafficWs.onmessage = (e): void => {
    const data = e.data as string
    window?.webContents.send('mihomoTraffic', JSON.parse(data) as IMihomoTrafficInfo)
  }

  mihomoTrafficWs.onclose = (): void => {
    mihomoTraffic()
  }

  mihomoTrafficWs.onerror = (): void => {
    if (mihomoTrafficWs) {
      mihomoTrafficWs.close()
      mihomoTrafficWs = null
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
  let server = getControledMihomoConfig()['external-controller']
  const secret = getControledMihomoConfig().secret ?? ''
  if (server?.startsWith(':')) server = `127.0.0.1${server}`
  stopMihomoLogs()

  mihomoLogsWs = new WebSocket(`ws://${server}/logs?secret=${secret}`)

  mihomoLogsWs.onmessage = (e): void => {
    const data = e.data as string
    window?.webContents.send('mihomoLogs', JSON.parse(data) as IMihomoLogInfo)
  }

  mihomoLogsWs.onclose = (): void => {
    mihomoLogs()
  }

  mihomoLogsWs.onerror = (): void => {
    if (mihomoLogsWs) {
      mihomoLogsWs.close()
      mihomoLogsWs = null
    }
  }
}
