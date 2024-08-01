import { ipcMain } from 'electron'
import {
  mihomoConfig,
  mihomoConnections,
  mihomoRules,
  mihomoVersion,
  patchMihomoConfig
} from './mihomoApi'
import { checkAutoRun, disableAutoRun, enableAutoRun } from './autoRun'
import {
  getAppConfig,
  setAppConfig,
  getControledMihomoConfig,
  setControledMihomoConfig,
  getProfileConfig,
  getCurrentProfileItem,
  getProfileItem,
  addProfileItem,
  removeProfileItem
} from './config'
import { restartCore } from './manager'

export function registerIpcMainHandlers(): void {
  ipcMain.handle('mihomoVersion', mihomoVersion)
  ipcMain.handle('mihomoConfig', mihomoConfig)
  ipcMain.handle('mihomoConnections', mihomoConnections)
  ipcMain.handle('mihomeRules', mihomoRules)
  ipcMain.handle('patchMihomoConfig', async (_e, patch) => await patchMihomoConfig(patch))
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
  ipcMain.handle('addProfileItem', (_e, item) => addProfileItem(item))
  ipcMain.handle('removeProfileItem', (_e, id) => removeProfileItem(id))
  ipcMain.handle('restartCore', () => restartCore())
}
