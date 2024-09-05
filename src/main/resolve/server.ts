import { getAppConfig, getControledMihomoConfig } from '../config'
import { Worker } from 'worker_threads'
import { resourcesFilesDir, subStoreDir } from '../utils/dirs'
import subStoreIcon from '../../../resources/subStoreIcon.png?asset'
import http from 'http'
import net from 'net'
import path from 'path'
import { nativeImage } from 'electron'
import express from 'express'

export let pacPort: number
export let subStorePort: number
export let subStoreFrontendPort: number

const defaultPacScript = `
function FindProxyForURL(url, host) {
  return "PROXY 127.0.0.1:%mixed-port%; SOCKS5 127.0.0.1:%mixed-port%; DIRECT;";
}
`

export function findAvailablePort(startPort: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.on('error', (err) => {
      if (startPort <= 65535) {
        resolve(findAvailablePort(startPort + 1))
      } else {
        reject(err)
      }
    })

    server.listen(startPort, () => {
      // 端口可用
      server.close(() => {
        resolve(startPort)
      })
    })
  })
}

export async function startPacServer(): Promise<void> {
  pacPort = await findAvailablePort(10000)
  const server = http
    .createServer(async (_req, res) => {
      const {
        sysProxy: { pacScript }
      } = await getAppConfig()
      const { 'mixed-port': port = 7890 } = await getControledMihomoConfig()
      let script = pacScript || defaultPacScript
      script = script.replaceAll('%mixed-port%', port.toString())
      res.writeHead(200, { 'Content-Type': 'application/x-ns-proxy-autoconfig' })
      res.end(script)
    })
    .listen(pacPort)
  server.unref()
}

export async function startSubStoreServer(): Promise<void> {
  const { useSubStore = true, useCustomSubStore = false } = await getAppConfig()
  if (!useSubStore) return
  if (!subStoreFrontendPort) {
    subStoreFrontendPort = await findAvailablePort(4000)
    const app = express()
    app.use(express.static(path.join(resourcesFilesDir(), 'sub-store-frontend')))
    app.listen(subStoreFrontendPort)
  }
  if (!useCustomSubStore && !subStorePort) {
    subStorePort = await findAvailablePort(3000)
    const icon = nativeImage.createFromPath(subStoreIcon)
    icon.toDataURL()
    new Worker(path.join(resourcesFilesDir(), 'sub-store.bundle.js'), {
      env: {
        SUB_STORE_BACKEND_API_PORT: subStorePort.toString(),
        SUB_STORE_DATA_BASE_PATH: subStoreDir(),
        SUB_STORE_BACKEND_CUSTOM_ICON: icon.toDataURL(),
        SUB_STORE_BACKEND_CUSTOM_NAME: 'Mihomo Party'
      }
    })
  }
}
