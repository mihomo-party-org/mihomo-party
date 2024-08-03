import { ChildProcess, execFileSync, execSync, spawn } from 'child_process'
import {
  logPath,
  mihomoCorePath,
  mihomoTestDir,
  mihomoWorkConfigPath,
  mihomoWorkDir
} from '../utils/dirs'
import { generateProfile } from '../resolve/factory'
import { getAppConfig } from '../config'
import fs from 'fs'

let child: ChildProcess

export function startCore(): void {
  const corePath = mihomoCorePath(getAppConfig().core ?? 'mihomo')
  generateProfile()
  checkProfile()
  stopCore()
  if (process.platform !== 'win32') {
    execSync(`chmod +x ${corePath}`)
  }
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
}

export function stopCore(): void {
  if (child) {
    child.kill('SIGINT')
  }
}

export function restartCore(): void {
  startCore()
}

export function checkProfile(): void {
  const corePath = mihomoCorePath(getAppConfig().core ?? 'mihomo')
  if (process.platform !== 'win32') {
    execSync(`chmod +x ${corePath}`)
  }

  execFileSync(corePath, ['-t', '-f', mihomoWorkConfigPath(), '-d', mihomoTestDir()])
}
