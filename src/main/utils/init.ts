import {
  appConfigPath,
  controledMihomoConfigPath,
  dataDir,
  logDir,
  mihomoTestDir,
  mihomoWorkDir,
  overrideConfigPath,
  overrideDir,
  profileConfigPath,
  profilePath,
  profilesDir,
  resourcesFilesDir
} from './dirs'
import {
  defaultConfig,
  defaultControledMihomoConfig,
  defaultOverrideConfig,
  defaultProfile,
  defaultProfileConfig
} from './template'
import yaml from 'yaml'
import { mkdir, writeFile, copyFile, rm, readdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { startPacServer } from '../resolve/server'
import { triggerSysProxy } from '../sys/sysproxy'
import { getAppConfig } from '../config'
import { app } from 'electron'

async function initDirs(): Promise<void> {
  if (!existsSync(dataDir())) {
    await mkdir(dataDir())
  }
  if (!existsSync(profilesDir())) {
    await mkdir(profilesDir())
  }
  if (!existsSync(overrideDir())) {
    await mkdir(overrideDir())
  }
  if (!existsSync(mihomoWorkDir())) {
    await mkdir(mihomoWorkDir())
  }
  if (!existsSync(logDir())) {
    await mkdir(logDir())
  }
  if (!existsSync(mihomoTestDir())) {
    await mkdir(mihomoTestDir())
  }
}

async function initConfig(): Promise<void> {
  if (!existsSync(appConfigPath())) {
    await writeFile(appConfigPath(), yaml.stringify(defaultConfig))
  }
  if (!existsSync(profileConfigPath())) {
    await writeFile(profileConfigPath(), yaml.stringify(defaultProfileConfig))
  }
  if (!existsSync(overrideConfigPath())) {
    await writeFile(overrideConfigPath(), yaml.stringify(defaultOverrideConfig))
  }
  if (!existsSync(profilePath('default'))) {
    await writeFile(profilePath('default'), yaml.stringify(defaultProfile))
  }
  if (!existsSync(controledMihomoConfigPath())) {
    await writeFile(controledMihomoConfigPath(), yaml.stringify(defaultControledMihomoConfig))
  }
}

async function initFiles(): Promise<void> {
  const copy = async (file: string): Promise<void> => {
    const targetPath = path.join(mihomoWorkDir(), file)
    const testTargrtPath = path.join(mihomoTestDir(), file)
    const sourcePath = path.join(resourcesFilesDir(), file)
    if (!existsSync(targetPath) && existsSync(sourcePath)) {
      await copyFile(sourcePath, targetPath)
    }
    if (!existsSync(testTargrtPath) && existsSync(sourcePath)) {
      await copyFile(sourcePath, testTargrtPath)
    }
  }
  await Promise.all([
    copy('country.mmdb'),
    copy('geoip.dat'),
    copy('geosite.dat'),
    copy('ASN.mmdb')
  ])
}

async function cleanup(): Promise<void> {
  // update cache
  const files = await readdir(dataDir())
  for (const file of files) {
    if (file.endsWith('.exe') || file.endsWith('.dmg')) {
      try {
        await rm(path.join(dataDir(), file))
      } catch {
        // ignore
      }
    }
  }
  // logs
  const { maxLogDays = 7 } = await getAppConfig()
  const logs = await readdir(logDir())
  for (const log of logs) {
    const date = new Date(log.split('.')[0])
    const diff = Date.now() - date.getTime()
    if (diff > maxLogDays * 24 * 60 * 60 * 1000) {
      try {
        await rm(path.join(logDir(), log))
      } catch {
        // ignore
      }
    }
  }
}

function initDeeplink(): void {
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient('clash', process.execPath, [path.resolve(process.argv[1])])
      app.setAsDefaultProtocolClient('mihomo', process.execPath, [path.resolve(process.argv[1])])
    }
  } else {
    app.setAsDefaultProtocolClient('clash')
    app.setAsDefaultProtocolClient('mihomo')
  }
}

export async function init(): Promise<void> {
  await initDirs()
  await initConfig()
  await initFiles()
  await cleanup()
  await startPacServer()
  const { sysProxy } = await getAppConfig()
  await triggerSysProxy(sysProxy.enable)

  initDeeplink()
}
