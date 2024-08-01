import { execFile, ChildProcess } from 'child_process'
import { mihomoCorePath, mihomoWorkDir } from './dirs'
import { generateProfile } from './factory'
import { appConfig } from './config'

let child: ChildProcess

export function startCore(): void {
  const corePath = mihomoCorePath(appConfig.core ?? 'mihomo')
  generateProfile()
  stopCore()
  child = execFile(corePath, ['-d', mihomoWorkDir()], (error, stdout) => {
    console.log(stdout)
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
