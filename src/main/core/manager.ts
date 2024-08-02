import { ChildProcess, execSync, spawn } from 'child_process'
import { logPath, mihomoCorePath, mihomoWorkDir } from '../utils/dirs'
import { generateProfile } from '../resolve/factory'
import { getAppConfig } from '../config'
import fs from 'fs'
let child: ChildProcess

export async function startCore(): Promise<void> {
  const corePath = mihomoCorePath(getAppConfig().core ?? 'mihomo')
  generateProfile()
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
