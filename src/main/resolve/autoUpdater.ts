import axios from 'axios'
import yaml from 'yaml'
import { app } from 'electron'
import { getControledMihomoConfig } from '../config'

export async function checkUpdate(): Promise<string | undefined> {
  const { 'mixed-port': mixedPort = 7890 } = await getControledMihomoConfig()
  const res = await axios.get(
    'https://github.com/pompurin404/mihomo-party/releases/latest/download/latest.yml',
    {
      headers: { 'Content-Type': 'application/octet-stream' },
      proxy: {
        protocol: 'http',
        host: '127.0.0.1',
        port: mixedPort
      }
    }
  )
  const latest = yaml.parse(res.data) as { version: string }
  const remoteVersion = latest.version
  const currentVersion = app.getVersion()
  if (remoteVersion !== currentVersion) {
    return remoteVersion
  } else {
    return undefined
  }
}
