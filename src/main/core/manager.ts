import { ChildProcess, execFile, execSync, spawn } from 'child_process'
import {
  logPath,
  mihomoCorePath,
  mihomoTestDir,
  mihomoWorkConfigPath,
  mihomoWorkDir
} from '../utils/dirs'
import { generateProfile } from '../resolve/factory'
import { getAppConfig, setAppConfig } from '../config'
import { dialog, safeStorage } from 'electron'
import fs from 'fs'

let child: ChildProcess
let retry = 10

export async function startCore(): Promise<void> {
  const corePath = mihomoCorePath(getAppConfig().core ?? 'mihomo')
  grantCorePermition(corePath)
  generateProfile()
  await checkProfile()
  stopCore()
  return new Promise((resolve, reject) => {
    child = spawn(corePath, ['-d', mihomoWorkDir()])
    child.stdout?.on('data', (data) => {
      if (data.toString().includes('External controller listen error')) {
        if (retry) {
          retry--
          resolve(startCore())
        } else {
          dialog.showErrorBox('External controller listen error', data.toString())
          reject('External controller listen error')
        }
      }
      if (data.toString().includes('RESTful API listening at')) {
        retry = 10
        resolve()
      }
      fs.writeFileSync(
        logPath(),
        data
          .toString()
          .split('\n')
          .map((line: string) => {
            if (line) return `[Mihomo]: ${line}`
            return ''
          })
          .filter(Boolean)
          .join('\n'),
        {
          flag: 'a'
        }
      )
    })
    child.on('error', (err) => {
      if (retry) {
        retry--
        startCore()
      } else {
        dialog.showErrorBox('External controller listen error', err.toString())
        reject(err)
      }
    })
    child.on('close', async (code, signal) => {
      fs.writeFileSync(logPath(), `[Manager]: Core closed, code: ${code}, signal: ${signal}\n`, {
        flag: 'a'
      })
      fs.writeFileSync(logPath(), `[Manager]: Restart Core\n`, {
        flag: 'a'
      })
      await startCore()
    })
  })
}

export function stopCore(): void {
  if (child) {
    child.removeAllListeners()
    if (!child.kill('SIGINT')) {
      stopCore()
    }
  }
}

export function checkProfile(): Promise<void> {
  const corePath = mihomoCorePath(getAppConfig().core ?? 'mihomo')
  return new Promise((resolve, reject) => {
    const child = execFile(corePath, ['-t', '-f', mihomoWorkConfigPath(), '-d', mihomoTestDir()])
    child.stdout?.on('data', (data) => {
      data
        .toString()
        .split('\n')
        .forEach((line: string) => {
          if (line.includes('level=error')) {
            dialog.showErrorBox('Profile Check Failed', line.split('level=error')[1])
            reject(line)
          }
        })
    })
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      }
    })
  })
}

export function grantCorePermition(corePath: string): void {
  if (getAppConfig().encryptedPassword && isEncryptionAvailable()) {
    const password = safeStorage.decryptString(Buffer.from(getAppConfig().encryptedPassword ?? []))
    try {
      if (process.platform === 'linux') {
        execSync(
          `echo "${password}" | sudo -S setcap cap_net_bind_service,cap_net_admin,cap_sys_ptrace,cap_dac_read_search,cap_dac_override,cap_net_raw=+ep ${corePath}`
        )
      }
      if (process.platform === 'darwin') {
        execSync(`echo "${password}" | sudo -S chown root:admin ${corePath}`)
        execSync(`echo "${password}" | sudo -S chmod +sx ${corePath}`)
      }
    } catch (e) {
      setAppConfig({ encryptedPassword: undefined })
    }
  }
}

export function isEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable()
}
