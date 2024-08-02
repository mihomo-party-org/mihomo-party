import axios, { AxiosInstance } from 'axios'
import { getControledMihomoConfig } from '../config'
import WebSocket from 'ws'
import { window } from '..'

let axiosIns: AxiosInstance = null!
let mihomoTrafficWs: WebSocket = null!

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

export const mihomoTraffic = (): void => {
  let server = getControledMihomoConfig()['external-controller']
  const secret = getControledMihomoConfig().secret ?? ''
  if (server?.startsWith(':')) server = `127.0.0.1${server}`

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
      mihomoTrafficWs = null!
    }
  }
}
