import { getAppConfig, getControledMihomoConfig } from '../config'
import http from 'http'
import net from 'net'

export let pacPort: number

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
