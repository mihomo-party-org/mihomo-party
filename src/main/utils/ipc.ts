import { app, dialog, ipcMain, safeStorage } from 'electron'
import {
  mihomoChangeProxy,
  mihomoCloseAllConnections,
  mihomoCloseConnection,
  mihomoGroupDelay,
  mihomoGroups,
  mihomoProxies,
  mihomoProxyDelay,
  mihomoProxyProviders,
  mihomoRuleProviders,
  mihomoRules,
  mihomoUpdateProxyProviders,
  mihomoUpdateRuleProviders,
  mihomoUpgrade,
  mihomoUpgradeGeo,
  mihomoVersion,
  patchMihomoConfig
} from '../core/mihomoApi'
import { checkAutoRun, disableAutoRun, enableAutoRun } from '../sys/autoRun'
import {
  getAppConfig,
  patchAppConfig,
  getControledMihomoConfig,
  patchControledMihomoConfig,
  getProfileConfig,
  getCurrentProfileItem,
  getProfileItem,
  addProfileItem,
  removeProfileItem,
  changeCurrentProfile,
  getProfileStr,
  setProfileStr,
  updateProfileItem,
  setProfileConfig,
  getOverrideConfig,
  setOverrideConfig,
  getOverrideItem,
  addOverrideItem,
  removeOverrideItem,
  getOverride,
  setOverride,
  updateOverrideItem
} from '../config'
import { isEncryptionAvailable, manualGrantCorePermition, restartCore } from '../core/manager'
import { triggerSysProxy } from '../sys/sysproxy'
import { checkUpdate, downloadAndInstallUpdate } from '../resolve/autoUpdater'
import {
  getFilePath,
  openFile,
  openUWPTool,
  readTextFile,
  setNativeTheme,
  setupFirewall
} from '../sys/misc'
import { getRuntimeConfig, getRuntimeConfigStr } from '../core/factory'
import { listWebdavBackups, webdavBackup, webdavDelete, webdavRestore } from '../resolve/backup'
import { getInterfaces } from '../sys/interface'
import { copyEnv } from '../resolve/tray'
import { registerShortcut } from '../resolve/shortcut'
import { mainWindow } from '..'

function ipcErrorWrapper<T>( // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fn: (...args: any[]) => Promise<T> // eslint-disable-next-line @typescript-eslint/no-explicit-any
): (...args: any[]) => Promise<T | { invokeError: unknown }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (...args: any[]) => {
    try {
      return await fn(...args)
    } catch (e) {
      if (e && typeof e === 'object') {
        if ('message' in e) {
          return { invokeError: e.message }
        } else {
          return { invokeError: JSON.stringify(e) }
        }
      }
      if (e instanceof Error || typeof e === 'string') {
        return { invokeError: e }
      }
      return { invokeError: 'Unknown Error' }
    }
  }
}
export function registerIpcMainHandlers(): void {
  ipcMain.handle('mihomoVersion', ipcErrorWrapper(mihomoVersion))
  ipcMain.handle('mihomoCloseConnection', (_e, id) => ipcErrorWrapper(mihomoCloseConnection)(id))
  ipcMain.handle('mihomoCloseAllConnections', ipcErrorWrapper(mihomoCloseAllConnections))
  ipcMain.handle('mihomoRules', ipcErrorWrapper(mihomoRules))
  ipcMain.handle('mihomoProxies', ipcErrorWrapper(mihomoProxies))
  ipcMain.handle('mihomoGroups', ipcErrorWrapper(mihomoGroups))
  ipcMain.handle('mihomoProxyProviders', ipcErrorWrapper(mihomoProxyProviders))
  ipcMain.handle('mihomoUpdateProxyProviders', (_e, name) =>
    ipcErrorWrapper(mihomoUpdateProxyProviders)(name)
  )
  ipcMain.handle('mihomoRuleProviders', ipcErrorWrapper(mihomoRuleProviders))
  ipcMain.handle('mihomoUpdateRuleProviders', (_e, name) =>
    ipcErrorWrapper(mihomoUpdateRuleProviders)(name)
  )
  ipcMain.handle('mihomoChangeProxy', (_e, group, proxy) =>
    ipcErrorWrapper(mihomoChangeProxy)(group, proxy)
  )
  ipcMain.handle('mihomoUpgradeGeo', ipcErrorWrapper(mihomoUpgradeGeo))
  ipcMain.handle('mihomoUpgrade', ipcErrorWrapper(mihomoUpgrade))
  ipcMain.handle('mihomoProxyDelay', (_e, proxy, url) =>
    ipcErrorWrapper(mihomoProxyDelay)(proxy, url)
  )
  ipcMain.handle('mihomoGroupDelay', (_e, group, url) =>
    ipcErrorWrapper(mihomoGroupDelay)(group, url)
  )
  ipcMain.handle('patchMihomoConfig', (_e, patch) => ipcErrorWrapper(patchMihomoConfig)(patch))
  ipcMain.handle('checkAutoRun', ipcErrorWrapper(checkAutoRun))
  ipcMain.handle('enableAutoRun', ipcErrorWrapper(enableAutoRun))
  ipcMain.handle('disableAutoRun', ipcErrorWrapper(disableAutoRun))
  ipcMain.handle('getAppConfig', (_e, force) => ipcErrorWrapper(getAppConfig)(force))
  ipcMain.handle('patchAppConfig', (_e, config) => ipcErrorWrapper(patchAppConfig)(config))
  ipcMain.handle('getControledMihomoConfig', (_e, force) =>
    ipcErrorWrapper(getControledMihomoConfig)(force)
  )
  ipcMain.handle('patchControledMihomoConfig', (_e, config) =>
    ipcErrorWrapper(patchControledMihomoConfig)(config)
  )
  ipcMain.handle('getProfileConfig', (_e, force) => ipcErrorWrapper(getProfileConfig)(force))
  ipcMain.handle('setProfileConfig', (_e, config) => ipcErrorWrapper(setProfileConfig)(config))
  ipcMain.handle('getCurrentProfileItem', ipcErrorWrapper(getCurrentProfileItem))
  ipcMain.handle('getProfileItem', (_e, id) => ipcErrorWrapper(getProfileItem)(id))
  ipcMain.handle('getProfileStr', (_e, id) => ipcErrorWrapper(getProfileStr)(id))
  ipcMain.handle('setProfileStr', (_e, id, str) => ipcErrorWrapper(setProfileStr)(id, str))
  ipcMain.handle('updateProfileItem', (_e, item) => ipcErrorWrapper(updateProfileItem)(item))
  ipcMain.handle('changeCurrentProfile', (_e, id) => ipcErrorWrapper(changeCurrentProfile)(id))
  ipcMain.handle('addProfileItem', (_e, item) => ipcErrorWrapper(addProfileItem)(item))
  ipcMain.handle('removeProfileItem', (_e, id) => ipcErrorWrapper(removeProfileItem)(id))
  ipcMain.handle('getOverrideConfig', (_e, force) => ipcErrorWrapper(getOverrideConfig)(force))
  ipcMain.handle('setOverrideConfig', (_e, config) => ipcErrorWrapper(setOverrideConfig)(config))
  ipcMain.handle('getOverrideItem', (_e, id) => ipcErrorWrapper(getOverrideItem)(id))
  ipcMain.handle('addOverrideItem', (_e, item) => ipcErrorWrapper(addOverrideItem)(item))
  ipcMain.handle('removeOverrideItem', (_e, id) => ipcErrorWrapper(removeOverrideItem)(id))
  ipcMain.handle('updateOverrideItem', (_e, item) => ipcErrorWrapper(updateOverrideItem)(item))
  ipcMain.handle('getOverride', (_e, id, ext) => ipcErrorWrapper(getOverride)(id, ext))
  ipcMain.handle('setOverride', (_e, id, ext, str) => ipcErrorWrapper(setOverride)(id, ext, str))
  ipcMain.handle('restartCore', ipcErrorWrapper(restartCore))
  ipcMain.handle('triggerSysProxy', (_e, enable) => ipcErrorWrapper(triggerSysProxy)(enable))
  ipcMain.handle('isEncryptionAvailable', isEncryptionAvailable)
  ipcMain.handle('encryptString', (_e, str) => encryptString(str))
  ipcMain.handle('manualGrantCorePermition', (_e, password) =>
    ipcErrorWrapper(manualGrantCorePermition)(password)
  )
  ipcMain.handle('getFilePath', (_e, ext) => getFilePath(ext))
  ipcMain.handle('readTextFile', (_e, filePath) => ipcErrorWrapper(readTextFile)(filePath))
  ipcMain.handle('getRuntimeConfigStr', ipcErrorWrapper(getRuntimeConfigStr))
  ipcMain.handle('getRuntimeConfig', ipcErrorWrapper(getRuntimeConfig))
  ipcMain.handle('downloadAndInstallUpdate', (_e, version) =>
    ipcErrorWrapper(downloadAndInstallUpdate)(version)
  )
  ipcMain.handle('checkUpdate', ipcErrorWrapper(checkUpdate))
  ipcMain.handle('getVersion', () => app.getVersion())
  ipcMain.handle('platform', () => process.platform)
  ipcMain.handle('openUWPTool', ipcErrorWrapper(openUWPTool))
  ipcMain.handle('setupFirewall', ipcErrorWrapper(setupFirewall))
  ipcMain.handle('getInterfaces', getInterfaces)
  ipcMain.handle('webdavBackup', ipcErrorWrapper(webdavBackup))
  ipcMain.handle('webdavRestore', (_e, filename) => ipcErrorWrapper(webdavRestore)(filename))
  ipcMain.handle('listWebdavBackups', ipcErrorWrapper(listWebdavBackups))
  ipcMain.handle('webdavDelete', (_e, filename) => ipcErrorWrapper(webdavDelete)(filename))
  ipcMain.handle('registerShortcut', (_e, oldShortcut, newShortcut, action) =>
    ipcErrorWrapper(registerShortcut)(oldShortcut, newShortcut, action)
  )
  ipcMain.handle('setNativeTheme', (_e, theme) => {
    setNativeTheme(theme)
  })
  ipcMain.handle('setTitleBarOverlay', (_e, overlay) => {
    mainWindow?.setTitleBarOverlay(overlay)
  })
  ipcMain.handle('setAlwaysOnTop', (_e, alwaysOnTop) => {
    mainWindow?.setAlwaysOnTop(alwaysOnTop)
  })
  ipcMain.handle('isAlwaysOnTop', () => {
    return mainWindow?.isAlwaysOnTop()
  })
  ipcMain.handle('openFile', (_e, type, id, ext) => openFile(type, id, ext))
  ipcMain.handle('copyEnv', ipcErrorWrapper(copyEnv))
  ipcMain.handle('alert', (_e, msg) => {
    dialog.showErrorBox('Mihomo Party', msg)
  })
  ipcMain.handle('relaunchApp', () => {
    app.relaunch()
    app.quit()
  })
  ipcMain.handle('quitApp', () => app.quit())
}

function encryptString(str: string): number[] {
  return safeStorage.encryptString(str).toJSON().data
}
