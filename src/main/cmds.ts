import { ipcMain } from 'electron'
import { mihomoVersion } from './mihomo-api'
import { checkAutoRun, disableAutoRun, enableAutoRun } from './autoRun'

export function registerIpcMainHandlers(): void {
  ipcMain.handle('mihomoVersion', mihomoVersion)
  ipcMain.handle('checkAutoRun', checkAutoRun)
  ipcMain.handle('enableAutoRun', enableAutoRun)
  ipcMain.handle('disableAutoRun', disableAutoRun)
}
