import axios from 'axios'
import yaml from 'yaml'
import { app } from 'electron'
import { getControledMihomoConfig } from '../config'

export async function checkUpdate(): Promise<string | undefined> {
  try {
    const res = await axios.get(
      'https://github.com/pompurin404/mihomo-party/releases/latest/download/latest.yml',
      {
        headers: { 'Content-Type': 'application/octet-stream' },
        proxy: {
          protocol: 'http',
          host: '127.0.0.1',
          port: getControledMihomoConfig()['mixed-port'] || 7890
        }
      }
    )
    const latest = yaml.parse(res.data)
    const remoteVersion = latest.version
    const currentVersion = app.getVersion()
    if (remoteVersion !== currentVersion) {
      return remoteVersion
    }
  } catch (e) {
    console.error(e)
  }
  return undefined
}
