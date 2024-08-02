import {
  appConfigPath,
  controledMihomoConfigPath,
  dataDir,
  logDir,
  mihomoTestDir,
  mihomoWorkDir,
  profileConfigPath,
  profilePath,
  profilesDir,
  resourcesFilesDir
} from '../utils/dirs'
import {
  defaultConfig,
  defaultControledMihomoConfig,
  defaultProfile,
  defaultProfileConfig
} from '../utils/template'
import yaml from 'yaml'
import fs from 'fs'
import path from 'path'
import { startPacServer } from './server'
import { triggerSysProxy } from './sysproxy'
import { getAppConfig } from '../config'

function initDirs(): void {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir)
  }
  if (!fs.existsSync(profilesDir())) {
    fs.mkdirSync(profilesDir())
  }
  if (!fs.existsSync(mihomoWorkDir())) {
    fs.mkdirSync(mihomoWorkDir())
  }
  if (!fs.existsSync(logDir())) {
    fs.mkdirSync(logDir())
  }
  if (!fs.existsSync(mihomoTestDir())) {
    fs.mkdirSync(mihomoTestDir())
  }
}

function initConfig(): void {
  if (!fs.existsSync(appConfigPath())) {
    fs.writeFileSync(appConfigPath(), yaml.stringify(defaultConfig))
  }
  if (!fs.existsSync(profileConfigPath())) {
    fs.writeFileSync(profileConfigPath(), yaml.stringify(defaultProfileConfig))
  }
  if (!fs.existsSync(profilePath('default'))) {
    fs.writeFileSync(profilePath('default'), yaml.stringify(defaultProfile))
  }
  if (!fs.existsSync(controledMihomoConfigPath())) {
    fs.writeFileSync(controledMihomoConfigPath(), yaml.stringify(defaultControledMihomoConfig))
  }
}

function initFiles(): void {
  const fileList = ['Country.mmdb', 'geoip.dat', 'geosite.dat']
  for (const file of fileList) {
    const targetPath = path.join(mihomoWorkDir(), file)
    const testTargrtPath = path.join(mihomoTestDir(), file)
    const sourcePath = path.join(resourcesFilesDir(), file)
    if (!fs.existsSync(targetPath) && fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, targetPath)
    }
    if (!fs.existsSync(testTargrtPath) && fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, testTargrtPath)
    }
  }
}

export function init(): void {
  initDirs()
  initConfig()
  initFiles()
  startPacServer().then(() => {
    triggerSysProxy(getAppConfig().sysProxy.enable)
  })
}
