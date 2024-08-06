import {
  appConfigPath,
  controledMihomoConfigPath,
  dataDir,
  exePath,
  logDir,
  mihomoCorePath,
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
import { app } from 'electron'
import { execSync } from 'child_process'

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

function initDeeplink(): void {
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient('clash', process.execPath, [path.resolve(process.argv[1])])
    }
  } else {
    app.setAsDefaultProtocolClient('clash')
  }
}

function initFirewall(): void {
  const removeCommand = `
  Remove-NetFirewallRule -DisplayName "mihomo" -ErrorAction SilentlyContinue
  Remove-NetFirewallRule -DisplayName "mihomo-alpha" -ErrorAction SilentlyContinue
  Remove-NetFirewallRule -DisplayName "Mihomo Party" -ErrorAction SilentlyContinue
  `
  const createCommand = `
  New-NetFirewallRule -DisplayName "mihomo" -Direction Inbound -Action Allow -Program "${mihomoCorePath('mihomo')}" -Enabled True -Profile Any -ErrorAction SilentlyContinue
  New-NetFirewallRule -DisplayName "mihomo-alpha" -Direction Inbound -Action Allow -Program "${mihomoCorePath('mihomo-alpha')}" -Enabled True -Profile Any -ErrorAction SilentlyContinue
  New-NetFirewallRule -DisplayName "Mihomo Party" -Direction Inbound -Action Allow -Program "${exePath()}" -Enabled True -Profile Any -ErrorAction SilentlyContinue
  `

  if (process.platform === 'win32') {
    try {
      execSync(removeCommand, { shell: 'powershell' })
    } catch {
      console.log('Remove-NetFirewallRule Failed')
    }
    try {
      execSync(createCommand, { shell: 'powershell' })
    } catch {
      console.log('New-NetFirewallRule Failed')
    }
  }
}

export function init(): void {
  initDirs()
  initConfig()
  initFiles()
  initDeeplink()
  initFirewall()
  startPacServer().then(() => {
    triggerSysProxy(getAppConfig().sysProxy.enable)
  })
}
