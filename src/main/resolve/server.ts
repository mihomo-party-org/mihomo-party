import { getAppConfig, getControledMihomoConfig } from '../config'
import { Worker } from 'worker_threads'
import { mihomoWorkDir, resourcesFilesDir, subStoreDir } from '../utils/dirs'
import subStoreIcon from '../../../resources/subStoreIcon.png?asset'
import http from 'http'
import net from 'net'
import path from 'path'
import { nativeImage } from 'electron'
import express from 'express'

export let pacPort: number
export let subStorePort: number
export let subStoreFrontendPort: number
let subStoreFrontendServer: http.Server
let subStoreBackendWorker: Worker

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

let pacServer: http.Server

export async function startPacServer(): Promise<void> {
  await stopPacServer()
  const { sysProxy } = await getAppConfig()
  const { mode = 'manual', host: cHost, pacScript } = sysProxy
  if (mode !== 'auto') {
    return
  }
  const host = cHost || '127.0.0.1'
  let script = pacScript || defaultPacScript
  const { 'mixed-port': port = 7890 } = await getControledMihomoConfig()
  script = script.replaceAll('%mixed-port%', port.toString())
  pacPort = await findAvailablePort(10000)
  pacServer = http
    .createServer(async (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/x-ns-proxy-autoconfig' })
      res.end(script)
    })
    .listen(pacPort, host)
}

export async function stopPacServer(): Promise<void> {
  if (pacServer) {
    pacServer.close()
  }
}

export async function startSubStoreFrontendServer(): Promise<void> {
  const { useSubStore = true, subStoreHost = '127.0.0.1' } = await getAppConfig()
  if (!useSubStore) return
  await stopSubStoreFrontendServer()
  subStoreFrontendPort = await findAvailablePort(14122)
  const app = express()
  app.use(express.static(path.join(resourcesFilesDir(), 'sub-store-frontend')))
  subStoreFrontendServer = app.listen(subStoreFrontendPort, subStoreHost)
}

export async function stopSubStoreFrontendServer(): Promise<void> {
  if (subStoreFrontendServer) {
    subStoreFrontendServer.close()
  }
}

export async function startSubStoreBackendServer(): Promise<void> {
  const {
    useSubStore = true,
    useCustomSubStore = false,
    subStoreHost = '127.0.0.1',
    subStoreBackendSyncCron = '',
    subStoreBackendDownloadCron = '',
    subStoreBackendUploadCron = ''
  } = await getAppConfig()
  const { 'mixed-port': port = 7890 } = await getControledMihomoConfig()
  if (!useSubStore) return
  if (!useCustomSubStore) {
    await stopSubStoreBackendServer()
    subStorePort = await findAvailablePort(38324)
    const icon = nativeImage.createFromPath(subStoreIcon)
    icon.toDataURL()
    subStoreBackendWorker = new Worker(path.join(resourcesFilesDir(), 'sub-store.bundle.js'), {
      env: {
        SUB_STORE_BACKEND_API_PORT: subStorePort.toString(),
        SUB_STORE_BACKEND_API_HOST: subStoreHost,
        SUB_STORE_DATA_BASE_PATH: subStoreDir(),
        SUB_STORE_BACKEND_CUSTOM_ICON: icon.toDataURL(),
        SUB_STORE_BACKEND_CUSTOM_NAME: 'Mihomo Party',
        SUB_STORE_BACKEND_SYNC_CRON: subStoreBackendSyncCron,
        SUB_STORE_BACKEND_DOWNLOAD_CRON: subStoreBackendDownloadCron,
        SUB_STORE_BACKEND_UPLOAD_CRON: subStoreBackendUploadCron,
        SUB_STORE_MMDB_COUNTRY_PATH: path.join(mihomoWorkDir(), 'country.mmdb'),
        SUB_STORE_MMDB_ASN_PATH: path.join(mihomoWorkDir(), 'ASN.mmdb'),
        HTTP_PROXY: `http://127.0.0.1:${port}`,
        HTTPS_PROXY: `http://127.0.0.1:${port}`,
        ALL_PROXY: `http://127.0.0.1:${port}`
      }
    })
  }
}

export async function stopSubStoreBackendServer(): Promise<void> {
  if (subStoreBackendWorker) {
    subStoreBackendWorker.terminate()
  }
}
