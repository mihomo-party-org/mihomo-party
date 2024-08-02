import {
  appConfigPath,
  controledMihomoConfigPath,
  dataDir,
  logDir,
  mihomoWorkDir,
  profileConfigPath,
  profilePath,
  profilesDir,
  resourcesFilesDir
} from '../utils/dirs'
import {
  getAppConfig,
  getControledMihomoConfig,
  getCurrentProfile,
  getProfileConfig
} from '../config'
import {
  defaultConfig,
  defaultControledMihomoConfig,
  defaultProfile,
  defaultProfileConfig
} from '../utils/template'
import yaml from 'yaml'
import fs from 'fs'
import path from 'path'

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
  getAppConfig(true)
  getControledMihomoConfig(true)
  getProfileConfig(true)
  getCurrentProfile(true)
}

function initFiles(): void {
  const fileList = ['Country.mmdb', 'geoip.dat', 'geosite.dat']
  for (const file of fileList) {
    const targetPath = path.join(profilesDir(), file)
    const sourcePath = path.join(resourcesFilesDir(), file)
    if (!fs.existsSync(targetPath) && fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, targetPath)
    }
  }
}

export function init(): void {
  initDirs()
  initConfig()
  initFiles()
}
