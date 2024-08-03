import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerIpcMainHandlers } from './utils/cmds'
import { app, shell, BrowserWindow } from 'electron'
import { stopCore, startCore } from './core/manager'
import { triggerSysProxy } from './resolve/sysproxy'
import icon from '../../resources/icon.png?asset'
import { createTray } from './core/tray'
import { init } from './resolve/init'
import { getAppConfig } from './config'
import { join } from 'path'
import {
  startMihomoMemory,
  startMihomoTraffic,
  stopMihomoMemory,
  stopMihomoTraffic
} from './core/mihomoApi'

export let window: BrowserWindow | null = null

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  init()
  startCore()

  app.on('second-instance', () => {
    window?.show()
    window?.focusOnWebView()
  })

  // Quit when all windows are closed, except on macOS. There, it's common
  // for applications and their menu bar to stay active until the user quits
  // explicitly with Cmd + Q.
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  app.on('before-quit', () => {
    stopCore()
    triggerSysProxy(false)
    app.exit()
  })

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  app.whenReady().then(() => {
    // Set app user model id for windows
    electronApp.setAppUserModelId('party.mihomo.app')

    // Default open or close DevTools by F12 in development
    // and ignore CommandOrControl + R in production.
    // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })
    registerIpcMainHandlers()
    createWindow()
    createTray()
    app.on('activate', function () {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

function createWindow(): void {
  // Create the browser window.
  window = new BrowserWindow({
    minWidth: 800,
    minHeight: 600,
    width: 800,
    height: 600,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon: icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  window.on('ready-to-show', () => {
    if (!getAppConfig().silentStart) {
      window?.show()
      window?.focusOnWebView()
    }
  })

  window.on('resize', () => {
    window?.webContents.send('resize')
  })

  window.on('show', () => {
    startMihomoTraffic()
    startMihomoMemory()
  })

  window.on('close', (event) => {
    stopMihomoTraffic()
    stopMihomoMemory()
    event.preventDefault()
    window?.hide()
  })

  window.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'))
  }
}
