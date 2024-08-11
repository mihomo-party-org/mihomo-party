import { app, dialog, ipcMain, safeStorage } from 'electron'
import {
  mihomoChangeProxy,
  mihomoCloseAllConnections,
  mihomoCloseConnection,
  mihomoGroupDelay,
  mihomoProxies,
  mihomoProxyDelay,
  mihomoProxyProviders,
  mihomoRuleProviders,
  mihomoRules,
  mihomoUpdateProxyProviders,
  mihomoUpdateRuleProviders,
  mihomoUpgradeGeo,
  mihomoVersion,
  patchMihomoConfig,
  startMihomoConnections,
  startMihomoLogs,
  stopMihomoConnections,
  stopMihomoLogs
} from '../core/mihomoApi'
import { checkAutoRun, disableAutoRun, enableAutoRun } from '../resolve/autoRun'
import {
  getAppConfig,
  setAppConfig,
  getControledMihomoConfig,
  setControledMihomoConfig,
  getProfileConfig,
  getCurrentProfileItem,
  getProfileItem,
  addProfileItem,
  removeProfileItem,
  changeCurrentProfile,
  getProfileStr,
  setProfileStr,
  updateProfileItem,
  setProfileConfig
} from '../config'
import { isEncryptionAvailable, restartCore } from '../core/manager'
import { triggerSysProxy } from '../resolve/sysproxy'
import { checkUpdate } from '../resolve/autoUpdater'
import { exePath, mihomoCorePath, mihomoWorkConfigPath, resourcesDir } from './dirs'
import { execFile, execSync } from 'child_process'
import yaml from 'yaml'
import fs from 'fs'
import path from 'path'

export function registerIpcMainHandlers(): void {
  ipcMain.handle('mihomoVersion', mihomoVersion)
  ipcMain.handle('mihomoCloseConnection', (_e, id) => mihomoCloseConnection(id))
  ipcMain.handle('mihomoCloseAllConnections', mihomoCloseAllConnections)
  ipcMain.handle('mihomoRules', mihomoRules)
  ipcMain.handle('mihomoProxies', mihomoProxies)
  ipcMain.handle('mihomoProxyProviders', () => mihomoProxyProviders())
  ipcMain.handle('mihomoUpdateProxyProviders', (_e, name) => mihomoUpdateProxyProviders(name))
  ipcMain.handle('mihomoRuleProviders', () => mihomoRuleProviders())
  ipcMain.handle('mihomoUpdateRuleProviders', (_e, name) => mihomoUpdateRuleProviders(name))
  ipcMain.handle('mihomoChangeProxy', (_e, group, proxy) => mihomoChangeProxy(group, proxy))
  ipcMain.handle('mihomoUpgradeGeo', mihomoUpgradeGeo)
  ipcMain.handle('mihomoProxyDelay', (_e, proxy, url) => mihomoProxyDelay(proxy, url))
  ipcMain.handle('mihomoGroupDelay', (_e, group, url) => mihomoGroupDelay(group, url))
  ipcMain.handle('startMihomoLogs', startMihomoLogs)
  ipcMain.handle('stopMihomoLogs', stopMihomoLogs)
  ipcMain.handle('startMihomoConnections', () => startMihomoConnections())
  ipcMain.handle('stopMihomoConnections', () => stopMihomoConnections())
  ipcMain.handle('patchMihomoConfig', (_e, patch) => patchMihomoConfig(patch))
  ipcMain.handle('checkAutoRun', checkAutoRun)
  ipcMain.handle('enableAutoRun', enableAutoRun)
  ipcMain.handle('disableAutoRun', disableAutoRun)
  ipcMain.handle('getAppConfig', (_e, force) => getAppConfig(force))
  ipcMain.handle('setAppConfig', (_e, config) => setAppConfig(config))
  ipcMain.handle('getControledMihomoConfig', (_e, force) => getControledMihomoConfig(force))
  ipcMain.handle('setControledMihomoConfig', (_e, config) => setControledMihomoConfig(config))
  ipcMain.handle('getProfileConfig', (_e, force) => getProfileConfig(force))
  ipcMain.handle('setProfileConfig', (_e, config) => setProfileConfig(config))
  ipcMain.handle('getCurrentProfileItem', getCurrentProfileItem)
  ipcMain.handle('getProfileItem', (_e, id) => getProfileItem(id))
  ipcMain.handle('getProfileStr', (_e, id) => getProfileStr(id))
  ipcMain.handle('setProfileStr', (_e, id, str) => setProfileStr(id, str))
  ipcMain.handle('updateProfileItem', (_e, item) => updateProfileItem(item))
  ipcMain.handle('changeCurrentProfile', (_e, id) => changeCurrentProfile(id))
  ipcMain.handle('addProfileItem', (_e, item) => addProfileItem(item))
  ipcMain.handle('removeProfileItem', (_e, id) => removeProfileItem(id))
  ipcMain.handle('restartCore', restartCore)
  ipcMain.handle('triggerSysProxy', (_e, enable) => triggerSysProxy(enable))
  ipcMain.handle('isEncryptionAvailable', isEncryptionAvailable)
  ipcMain.handle('encryptString', (_e, str) => safeStorage.encryptString(str))
  ipcMain.handle('getFilePath', getFilePath)
  ipcMain.handle('readTextFile', (_e, filePath) => readTextFile(filePath))
  ipcMain.handle('getRuntimeConfigStr', getRuntimeConfigStr)
  ipcMain.handle('getRuntimeConfig', getRuntimeConfig)
  ipcMain.handle('checkUpdate', () => checkUpdate())
  ipcMain.handle('getVersion', () => app.getVersion())
  ipcMain.handle('platform', () => process.platform)
  ipcMain.handle('openUWPTool', openUWPTool)
  ipcMain.handle('setupFirewall', setupFirewall)
  ipcMain.handle('quitApp', () => app.quit())
}

function getFilePath(): string[] | undefined {
  return dialog.showOpenDialogSync({
    title: '选择订阅文件',
    filters: [{ name: 'Yaml Files', extensions: ['yml', 'yaml'] }],
    properties: ['openFile']
  })
}

function readTextFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8')
}

function getRuntimeConfigStr(): string {
  return fs.readFileSync(mihomoWorkConfigPath(), 'utf8')
}

function getRuntimeConfig(): IMihomoConfig {
  return yaml.parse(getRuntimeConfigStr())
}

function openUWPTool(): void {
  const uwpToolPath = path.join(resourcesDir(), 'files', 'enableLoopback.exe')
  const child = execFile(uwpToolPath)
  child.unref()
}

async function setupFirewall(): Promise<void> {
  return new Promise((resolve, reject) => {
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
        console.error('Remove-NetFirewallRule Failed')
      }
      try {
        execSync(createCommand, { shell: 'powershell' })
      } catch (e) {
        dialog.showErrorBox('防火墙设置失败', `${e}`)
        reject(e)
        console.error('New-NetFirewallRule Failed')
      }
    }
    resolve()
  })
}
