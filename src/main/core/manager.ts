import { ChildProcess, exec, execFile, spawn } from 'child_process'
import {
  logPath,
  mihomoCoreDir,
  mihomoCorePath,
  mihomoTestDir,
  mihomoWorkConfigPath,
  mihomoWorkDir
} from '../utils/dirs'
import { generateProfile } from './factory'
import { getAppConfig, getControledMihomoConfig, patchAppConfig } from '../config'
import { dialog, safeStorage } from 'electron'
import { pauseWebsockets, startMihomoTraffic } from './mihomoApi'
import chokidar from 'chokidar'
import { writeFile } from 'fs/promises'
import { promisify } from 'util'
import { mainWindow } from '..'
import path from 'path'

chokidar
  .watch(path.join(mihomoCoreDir(), 'meta-update'))
  .on('all', (event, path) => {
    console.log(event, path)
  })
  .on('unlinkDir', async () => {
    try {
      await stopCore(true)
      await startCore()
    } catch (e) {
      dialog.showErrorBox('内核启动出错', `${e}`)
    }
  })

let child: ChildProcess
let retry = 10

export async function startCore(): Promise<Promise<void>[]> {
  const { core = 'mihomo', autoSetDNS = true } = await getAppConfig()
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
  child = spawn(corePath, ['-d', mihomoWorkDir()])
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
      if (data.toString().includes('configure tun interface: operation not permitted')) {
        reject('虚拟网卡启动失败, 请尝试手动授予内核权限')
      }
      if (data.toString().includes('External controller listen error')) {
        if (retry) {
          retry--
          try {
            resolve(await startCore())
          } catch (e) {
            reject(e)
          }
        } else {
          reject('内核连接失败, 请尝试修改外部控制端口或重启电脑')
        }
      }
      if (data.toString().includes('RESTful API listening at')) {
        resolve([
          new Promise((resolve) => {
            child.stdout?.on('data', async (data) => {
              if (data.toString().includes('Start initial Compatible provider default')) {
                mainWindow?.webContents.send('coreRestart')
                resolve()
              }
            })
          })
        ])
        await startMihomoTraffic()
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
}

export async function restartCore(): Promise<void> {
  try {
    const recover = pauseWebsockets()
    await startCore()
    recover()
  } catch (e) {
    dialog.showErrorBox('内核启动出错', `${e}`)
  }
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
    const password = safeStorage.decryptString(Buffer.from(encryptedPassword))
    if (process.platform === 'linux') {
      try {
        await execPromise(
          `echo "${password}" | sudo -S setcap cap_net_bind_service,cap_net_admin,cap_sys_ptrace,cap_dac_read_search,cap_dac_override,cap_net_raw=+ep ${corePath}`
        )
      } catch (error) {
        patchAppConfig({ encryptedPassword: undefined })
        throw error
      }
    }
    if (process.platform === 'darwin') {
      try {
        await execPromise(`echo "${password}" | sudo -S chown root:admin ${corePath}`)
        await execPromise(`echo "${password}" | sudo -S chmod +sx ${corePath}`)
      } catch (error) {
        patchAppConfig({ encryptedPassword: undefined })
        throw error
      }
    }
  }
}

export async function manualGrantCorePermition(password?: string): Promise<void> {
  const { core = 'mihomo' } = await getAppConfig()
  const corePath = mihomoCorePath(core)
  const execPromise = promisify(exec)
  if (process.platform === 'darwin') {
    const shell = `chown root:admin ${corePath}\nchmod +sx ${corePath}`
    const command = `do shell script "${shell}" with administrator privileges`
    await execPromise(`osascript -e '${command}'`)
  }
  if (process.platform === 'linux') {
    await execPromise(
      `echo "${password}" | sudo -S setcap cap_net_bind_service,cap_net_admin,cap_sys_ptrace,cap_dac_read_search,cap_dac_override,cap_net_raw=+ep ${corePath}`
    )
  }
}

export function isEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable()
}

async function getDefaultService(password?: string): Promise<string> {
  const execPromise = promisify(exec)
  let sudo = ''
  if (password) sudo = `echo "${password}" | sudo -S `
  const { stdout: deviceOut } = await execPromise(`${sudo}route -n get default`)
  let device = deviceOut.split('\n').find((s) => s.includes('interface:'))
  device = device?.trim().split(' ').slice(1).join(' ')
  if (!device) throw new Error('Get device failed')
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
  const { originDNS, encryptedPassword } = await getAppConfig()
  if (!originDNS) {
    let password: string | undefined
    if (encryptedPassword && isEncryptionAvailable()) {
      password = safeStorage.decryptString(Buffer.from(encryptedPassword))
    }
    await getOriginDNS(password)
    await setDNS('223.5.5.5', password)
  }
}

async function recoverDNS(): Promise<void> {
  if (process.platform !== 'darwin') return
  const { originDNS, encryptedPassword } = await getAppConfig()
  if (originDNS) {
    let password: string | undefined
    if (encryptedPassword && isEncryptionAvailable()) {
      password = safeStorage.decryptString(Buffer.from(encryptedPassword))
    }
    await setDNS(originDNS, password)
    await patchAppConfig({ originDNS: undefined })
  }
}
