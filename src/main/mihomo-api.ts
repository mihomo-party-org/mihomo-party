import axios, { AxiosInstance } from 'axios'
import { controledMihomoConfig } from './config'

let axiosIns: AxiosInstance = null!

/// initialize some information
/// enable force update axiosIns
export const getAxios = async (force: boolean = false): Promise<AxiosInstance> => {
  if (axiosIns && !force) return axiosIns

  let server = controledMihomoConfig['external-controller']
  const secret = controledMihomoConfig.secret ?? ''
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
