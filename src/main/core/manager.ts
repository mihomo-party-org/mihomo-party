import { ChildProcess, execFileSync, execSync, spawn } from 'child_process'
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

export function startCore(): void {
  const corePath = mihomoCorePath(getAppConfig().core ?? 'mihomo')
  grantCorePermition(corePath)
  generateProfile()
  checkProfile()
  stopCore()
  child = spawn(corePath, ['-d', mihomoWorkDir()])
  child.stdout?.on('data', (data) => {
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
  child.on('close', (code, signal) => {
    fs.writeFileSync(logPath(), `[Manager]: Core closed, code: ${code}, signal: ${signal}\n`, {
      flag: 'a'
    })
    fs.writeFileSync(logPath(), `[Manager]: Restart Core\n`, {
      flag: 'a'
    })
    restartCore()
  })
}

export function stopCore(): void {
  if (child) {
    child.removeAllListeners()
    child.kill('SIGINT')
  }
}

export function restartCore(): void {
  startCore()
}

export function checkProfile(): void {
  const corePath = mihomoCorePath(getAppConfig().core ?? 'mihomo')
  try {
    execFileSync(corePath, ['-t', '-f', mihomoWorkConfigPath(), '-d', mihomoTestDir()])
  } catch (e) {
    dialog.showErrorBox('Profile check failed', `${e}`)
    throw new Error('Profile check failed')
  }
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
