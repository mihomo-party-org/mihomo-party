import { is } from '@electron-toolkit/utils'
import { BrowserWindow, ipcMain } from 'electron'
import windowStateKeeper from 'electron-window-state'
import { join } from 'path'
import { getAppConfig, patchAppConfig } from '../config'
import { applyTheme } from './theme'
import { buildContextMenu, showTrayIcon } from './tray'

export let floatingWindow: BrowserWindow | null = null

async function createFloatingWindow(): Promise<void> {
  const floatingWindowState = windowStateKeeper({
    file: 'floating-window-state.json'
  })
  const { customTheme = 'default.css' } = await getAppConfig()
  floatingWindow = new BrowserWindow({
    width: 120,
    height: 42,
    x: floatingWindowState.x,
    y: floatingWindowState.y,
    show: false,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    transparent: true,
    skipTaskbar: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    closable: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      spellcheck: false,
      sandbox: false
    }
  })
  floatingWindowState.manage(floatingWindow)
  floatingWindow.on('ready-to-show', () => {
    applyTheme(customTheme)
    floatingWindow?.show()
    floatingWindow?.setAlwaysOnTop(true, 'screen-saver')
  })
  floatingWindow.on('moved', () => {
    if (floatingWindow) floatingWindowState.saveState(floatingWindow)
  })
  ipcMain.on('updateFloatingWindow', () => {
    if (floatingWindow) {
      floatingWindow?.webContents.send('controledMihomoConfigUpdated')
      floatingWindow?.webContents.send('appConfigUpdated')
    }
  })
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    floatingWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/floating.html`)
  } else {
    floatingWindow.loadFile(join(__dirname, '../renderer/floating.html'))
  }
}

export async function showFloatingWindow(): Promise<void> {
  if (floatingWindow) {
    floatingWindow.show()
  } else {
    createFloatingWindow()
  }
}

export async function triggerFloatingWindow(): Promise<void> {
  if (floatingWindow?.isVisible()) {
    await patchAppConfig({ showFloatingWindow: false })
    await closeFloatingWindow()
  } else {
    await patchAppConfig({ showFloatingWindow: true })
    await showFloatingWindow()
  }
}

export async function closeFloatingWindow(): Promise<void> {
  if (floatingWindow) {
    floatingWindow.close()
    floatingWindow.destroy()
    floatingWindow = null
  }
  await showTrayIcon()
  await patchAppConfig({ disableTray: false })
}

export async function showContextMenu(): Promise<void> {
  const menu = await buildContextMenu()
  menu.popup()
}
