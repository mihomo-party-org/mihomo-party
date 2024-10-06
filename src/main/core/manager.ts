import { ChildProcess, exec, execFile, spawn } from 'child_process'
import {
  dataDir,
  logPath,
  mihomoCoreDir,
  mihomoCorePath,
  mihomoTestDir,
  mihomoWorkConfigPath,
  mihomoWorkDir
} from '../utils/dirs'
import { generateProfile } from './factory'
import {
  getAppConfig,
  getControledMihomoConfig,
  patchAppConfig,
  patchControledMihomoConfig
} from '../config'
import { app, dialog, ipcMain, net, safeStorage } from 'electron'
import {
  startMihomoTraffic,
  startMihomoConnections,
  startMihomoLogs,
  startMihomoMemory,
  stopMihomoConnections,
  stopMihomoTraffic,
  stopMihomoLogs,
  stopMihomoMemory,
  patchMihomoConfig
} from './mihomoApi'
import chokidar from 'chokidar'
import { readFile, rm, writeFile } from 'fs/promises'
import { promisify } from 'util'
import { mainWindow } from '..'
import path from 'path'
import { existsSync } from 'fs'
import { uploadRuntimeConfig } from '../resolve/gistApi'
import { startMonitor } from '../resolve/trafficMonitor'

chokidar.watch(path.join(mihomoCoreDir(), 'meta-update'), {}).on('unlinkDir', async () => {
  try {
    await stopCore(true)
    await startCore()
  } catch (e) {
    dialog.showErrorBox('内核启动出错', `${e}`)
  }
})

export const mihomoIpcPath =
  process.platform === 'win32' ? '\\\\.\\pipe\\MihomoParty\\mihomo' : '/tmp/mihomo-party.sock'
const ctlParam = process.platform === 'win32' ? '-ext-ctl-pipe' : '-ext-ctl-unix'

let setPublicDNSTimer: NodeJS.Timeout | null = null
let recoverDNSTimer: NodeJS.Timeout | null = null
let child: ChildProcess
let retry = 10

export async function startCore(detached = false): Promise<Promise<void>[]> {
  const { core = 'mihomo', autoSetDNS = true, encryptedPassword } = await getAppConfig()
  const { 'log-level': logLevel } = await getControledMihomoConfig()
  if (existsSync(path.join(dataDir(), 'core.pid'))) {
    const pid = parseInt(await readFile(path.join(dataDir(), 'core.pid'), 'utf-8'))
    try {
      process.kill(pid, 'SIGINT')
    } catch {
      if (process.platform !== 'win32' && encryptedPassword && isEncryptionAvailable()) {
        const execPromise = promisify(exec)
        const password = safeStorage.decryptString(Buffer.from(encryptedPassword))
        try {
          await execPromise(`echo "${password}" | sudo -S kill ${pid}`)
        } catch {
          // ignore
        }
      }
    } finally {
      await rm(path.join(dataDir(), 'core.pid'))
    }
  }

  const { tun } = await getControledMihomoConfig()
  const corePath = mihomoCorePath(core)
  await autoGrantCorePermition(corePath)
  await generateProfile()
  await checkProfile()
  await stopCore()
  if (tun?.enable && autoSetDNS) {
    try {
      await setPublicDNS()
    } catch (error) {
      await writeFile(logPath(), `[Manager]: set dns failed, ${error}`, {
        flag: 'a'
      })
    }
  }

  child = spawn(corePath, ['-d', mihomoWorkDir(), ctlParam, mihomoIpcPath], {
    detached: detached,
    stdio: detached ? 'ignore' : undefined
  })
  if (detached) {
    child.unref()
    return new Promise((resolve) => {
      resolve([new Promise(() => {})])
    })
  }
  child.on('close', async (code, signal) => {
    await writeFile(logPath(), `[Manager]: Core closed, code: ${code}, signal: ${signal}\n`, {
      flag: 'a'
    })
    if (retry) {
      await writeFile(logPath(), `[Manager]: Try Restart Core\n`, { flag: 'a' })
      retry--
      await restartCore()
    } else {
      await stopCore()
    }
  })
  child.stdout?.on('data', async (data) => {
    await writeFile(logPath(), data, { flag: 'a' })
  })
  return new Promise((resolve, reject) => {
    child.stdout?.on('data', async (data) => {
      const str = data.toString()
      if (str.includes('configure tun interface: operation not permitted')) {
        patchControledMihomoConfig({ tun: { enable: false } })
        mainWindow?.webContents.send('controledMihomoConfigUpdated')
        ipcMain.emit('updateTrayMenu')
        reject('虚拟网卡启动失败, 请尝试手动授予内核权限')
      }

      if (
        (process.platform !== 'win32' && str.includes('RESTful API unix listening at')) ||
        (process.platform === 'win32' && str.includes('RESTful API pipe listening at'))
      ) {
        resolve([
          new Promise((resolve) => {
            child.stdout?.on('data', async (data) => {
              if (data.toString().includes('Start initial Compatible provider default')) {
                try {
                  mainWindow?.webContents.send('coreRestart')
                  await uploadRuntimeConfig()
                } catch {
                  // ignore
                }
                await patchMihomoConfig({ 'log-level': logLevel })
                resolve()
              }
            })
          })
        ])
        await startMihomoTraffic()
        await startMihomoConnections()
        await startMihomoLogs()
        await startMihomoMemory()
        retry = 10
      }
    })
  })
}

export async function stopCore(force = false): Promise<void> {
  try {
    if (!force) {
      await recoverDNS()
    }
  } catch (error) {
    await writeFile(logPath(), `[Manager]: recover dns failed, ${error}`, {
      flag: 'a'
    })
  }

  if (child) {
    child.removeAllListeners()
    child.kill('SIGINT')
  }
  stopMihomoTraffic()
  stopMihomoConnections()
  stopMihomoLogs()
  stopMihomoMemory()
}

export async function restartCore(): Promise<void> {
  try {
    await startCore()
  } catch (e) {
    dialog.showErrorBox('内核启动出错', `${e}`)
  }
}

export async function keepCoreAlive(): Promise<void> {
  try {
    await startCore(true)
    if (child && child.pid) {
      await writeFile(path.join(dataDir(), 'core.pid'), child.pid.toString())
    }
  } catch (e) {
    dialog.showErrorBox('内核启动出错', `${e}`)
  }
}

export async function quitWithoutCore(): Promise<void> {
  await keepCoreAlive()
  await startMonitor(true)
  app.exit()
}

async function checkProfile(): Promise<void> {
  const { core = 'mihomo' } = await getAppConfig()
  const corePath = mihomoCorePath(core)
  const execFilePromise = promisify(execFile)
  try {
    await execFilePromise(corePath, ['-t', '-f', mihomoWorkConfigPath(), '-d', mihomoTestDir()])
  } catch (error) {
    if (error instanceof Error && 'stdout' in error) {
      const { stdout } = error as { stdout: string }
      const errorLines = stdout
        .split('\n')
        .filter((line) => line.includes('level=error'))
        .map((line) => line.split('level=error')[1])
      throw new Error(`Profile Check Failed:\n${errorLines.join('\n')}`)
    } else {
      throw error
    }
  }
}

export async function autoGrantCorePermition(corePath: string): Promise<void> {
  if (process.platform === 'win32') return
  const { encryptedPassword } = await getAppConfig()
  const execPromise = promisify(exec)
  if (encryptedPassword && isEncryptionAvailable()) {
    try {
      const password = safeStorage.decryptString(Buffer.from(encryptedPassword))
      if (process.platform === 'linux') {
        await execPromise(`echo "${password}" | sudo -S chown root:root "${corePath}"`)
        await execPromise(`echo "${password}" | sudo -S chmod +sx "${corePath}"`)
      }
      if (process.platform === 'darwin') {
        await execPromise(`echo "${password}" | sudo -S chown root:admin "${corePath}"`)
        await execPromise(`echo "${password}" | sudo -S chmod +sx "${corePath}"`)
      }
    } catch (error) {
      patchAppConfig({ encryptedPassword: undefined })
      throw error
    }
  }
}

export async function manualGrantCorePermition(password?: string): Promise<void> {
  const { core = 'mihomo' } = await getAppConfig()
  const corePath = mihomoCorePath(core)
  const execPromise = promisify(exec)
  if (process.platform === 'darwin') {
    const shell = `chown root:admin ${corePath.replace(' ', '\\\\ ')}\nchmod +sx ${corePath.replace(' ', '\\\\ ')}`
    const command = `do shell script "${shell}" with administrator privileges`
    await execPromise(`osascript -e '${command}'`)
  }
  if (process.platform === 'linux') {
    await execPromise(`echo "${password}" | sudo -S chown root:root "${corePath}"`)
    await execPromise(`echo "${password}" | sudo -S chmod +sx "${corePath}"`)
  }
}

export function isEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable()
}

export async function getDefaultDevice(password?: string): Promise<string> {
  const execPromise = promisify(exec)
  let sudo = ''
  if (password) sudo = `echo "${password}" | sudo -S `
  const { stdout: deviceOut } = await execPromise(`${sudo}route -n get default`)
  let device = deviceOut.split('\n').find((s) => s.includes('interface:'))
  device = device?.trim().split(' ').slice(1).join(' ')
  if (!device) throw new Error('Get device failed')
  return device
}

async function getDefaultService(password?: string): Promise<string> {
  const execPromise = promisify(exec)
  let sudo = ''
  if (password) sudo = `echo "${password}" | sudo -S `
  const device = await getDefaultDevice(password)
  const { stdout: order } = await execPromise(`${sudo}networksetup -listnetworkserviceorder`)
  const block = order.split('\n\n').find((s) => s.includes(`Device: ${device}`))
  if (!block) throw new Error('Get networkservice failed')
  for (const line of block.split('\n')) {
    if (line.match(/^\(\d+\).*/)) {
      return line.trim().split(' ').slice(1).join(' ')
    }
  }
  throw new Error('Get service failed')
}

async function getOriginDNS(password?: string): Promise<void> {
  const execPromise = promisify(exec)
  let sudo = ''
  if (password) sudo = `echo "${password}" | sudo -S `
  const service = await getDefaultService(password)
  const { stdout: dns } = await execPromise(`${sudo}networksetup -getdnsservers "${service}"`)
  if (dns.startsWith("There aren't any DNS Servers set on")) {
    await patchAppConfig({ originDNS: 'Empty' })
  } else {
    await patchAppConfig({ originDNS: dns.trim().replace(/\n/g, ' ') })
  }
}

async function setDNS(dns: string, password?: string): Promise<void> {
  const service = await getDefaultService(password)
  let sudo = ''
  if (password) sudo = `echo "${password}" | sudo -S `
  const execPromise = promisify(exec)
  await execPromise(`${sudo}networksetup -setdnsservers "${service}" ${dns}`)
}

async function setPublicDNS(): Promise<void> {
  if (process.platform !== 'darwin') return
  if (net.isOnline()) {
    const { originDNS, encryptedPassword } = await getAppConfig()
    if (!originDNS) {
      let password: string | undefined
      if (encryptedPassword && isEncryptionAvailable()) {
        password = safeStorage.decryptString(Buffer.from(encryptedPassword))
      }
      await getOriginDNS(password)
      await setDNS('223.5.5.5', password)
    }
  } else {
    if (setPublicDNSTimer) clearTimeout(setPublicDNSTimer)
    setPublicDNSTimer = setTimeout(() => setPublicDNS(), 5000)
  }
}

async function recoverDNS(): Promise<void> {
  if (process.platform !== 'darwin') return
  if (net.isOnline()) {
    const { originDNS, encryptedPassword } = await getAppConfig()
    if (originDNS) {
      let password: string | undefined
      if (encryptedPassword && isEncryptionAvailable()) {
        password = safeStorage.decryptString(Buffer.from(encryptedPassword))
      }
      await setDNS(originDNS, password)
      await patchAppConfig({ originDNS: undefined })
    }
  } else {
    if (recoverDNSTimer) clearTimeout(recoverDNSTimer)
    recoverDNSTimer = setTimeout(() => recoverDNS(), 5000)
  }
}
