import { is } from '@electron-toolkit/utils'
import { app } from 'electron'
import path from 'path'

export const dataDir = app.getPath('userData')

export function resourcesDir(): string {
  if (is.dev) {
    return path.join(__dirname, '../../resources')
  } else {
    return path.join(process.resourcesPath)
  }
}

export function resourcesFilesDir(): string {
  return path.join(resourcesDir(), 'files')
}

export function mihomoCoreDir(): string {
  return path.join(resourcesDir(), 'sidecar')
}

export function mihomoCorePath(core: string): string {
  const isWin = process.platform === 'win32'
  return path.join(mihomoCoreDir(), `${core}${isWin ? '.exe' : ''}`)
}

export function appConfigPath(): string {
  return path.join(dataDir, 'config.yaml')
}

export function controledMihomoConfigPath(): string {
  return path.join(dataDir, 'mihomo.yaml')
}

export function profileConfigPath(): string {
  return path.join(dataDir, 'profile.yaml')
}

export function profilesDir(): string {
  return path.join(dataDir, 'profiles')
}

export function profilePath(id: string): string {
  return path.join(profilesDir(), `${id}.yaml`)
}

export function mihomoWorkDir(): string {
  return path.join(dataDir, 'work')
}

export function mihomoWorkConfigPath(): string {
  return path.join(mihomoWorkDir(), 'config.yaml')
}

export function logDir(): string {
  return path.join(dataDir, 'logs')
}

export function logPath(): string {
  const date = new Date()
  const name = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
  return path.join(logDir(), `${name}.log`)
}
