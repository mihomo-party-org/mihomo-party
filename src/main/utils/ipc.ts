import { app, ipcMain, safeStorage } from 'electron'
import {
  mihomoChangeProxy,
  mihomoCloseAllConnections,
  mihomoCloseConnection,
  mihomoConfig,
  mihomoConnections,
  mihomoProxies,
  mihomoProxyDelay,
  mihomoRules,
  mihomoVersion,
  patchMihomoConfig,
  startMihomoLogs,
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
  updateProfileItem
} from '../config'
import { isEncryptionAvailable, startCore } from '../core/manager'
import { triggerSysProxy } from '../resolve/sysproxy'
import { checkUpdate } from '../resolve/autoUpdater'

export function registerIpcMainHandlers(): void {
  ipcMain.handle('mihomoVersion', mihomoVersion)
  ipcMain.handle('mihomoConfig', mihomoConfig)
  ipcMain.handle('mihomoConnections', mihomoConnections)
  ipcMain.handle('mihomoCloseConnection', (_e, id) => mihomoCloseConnection(id))
  ipcMain.handle('mihomoCloseAllConnections', mihomoCloseAllConnections)
  ipcMain.handle('mihomoRules', mihomoRules)
  ipcMain.handle('mihomoProxies', mihomoProxies)
  ipcMain.handle('mihomoChangeProxy', (_e, group, proxy) => mihomoChangeProxy(group, proxy))
  ipcMain.handle('mihomoProxyDelay', (_e, proxy, url) => mihomoProxyDelay(proxy, url))
  ipcMain.handle('startMihomoLogs', startMihomoLogs)
  ipcMain.handle('stopMihomoLogs', stopMihomoLogs)
  ipcMain.handle('patchMihomoConfig', (_e, patch) => patchMihomoConfig(patch))
  ipcMain.handle('checkAutoRun', checkAutoRun)
  ipcMain.handle('enableAutoRun', enableAutoRun)
  ipcMain.handle('disableAutoRun', disableAutoRun)
  ipcMain.handle('getAppConfig', (_e, force) => getAppConfig(force))
  ipcMain.handle('setAppConfig', (_e, config) => setAppConfig(config))
  ipcMain.handle('getControledMihomoConfig', (_e, force) => getControledMihomoConfig(force))
  ipcMain.handle('setControledMihomoConfig', (_e, config) => setControledMihomoConfig(config))
  ipcMain.handle('getProfileConfig', (_e, force) => getProfileConfig(force))
  ipcMain.handle('getCurrentProfileItem', getCurrentProfileItem)
  ipcMain.handle('getProfileItem', (_e, id) => getProfileItem(id))
  ipcMain.handle('getProfileStr', (_e, id) => getProfileStr(id))
  ipcMain.handle('setProfileStr', (_e, id, str) => setProfileStr(id, str))
  ipcMain.handle('updateProfileItem', (_e, item) => updateProfileItem(item))
  ipcMain.handle('changeCurrentProfile', (_e, id) => changeCurrentProfile(id))
  ipcMain.handle('addProfileItem', (_e, item) => addProfileItem(item))
  ipcMain.handle('removeProfileItem', (_e, id) => removeProfileItem(id))
  ipcMain.handle('restartCore', startCore)
  ipcMain.handle('triggerSysProxy', (_e, enable) => triggerSysProxy(enable))
  ipcMain.handle('isEncryptionAvailable', isEncryptionAvailable)
  ipcMain.handle('encryptString', (_e, str) => safeStorage.encryptString(str))
  ipcMain.handle('checkUpdate', () => checkUpdate())
  ipcMain.handle('platform', () => process.platform)
  ipcMain.handle('quitApp', () => app.quit())
}
