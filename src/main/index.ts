import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerIpcMainHandlers } from './utils/ipc'
import { app, shell, BrowserWindow, Menu } from 'electron'
import { stopCore, startCore } from './core/manager'
import { triggerSysProxy } from './resolve/sysproxy'
import icon from '../../resources/icon.png?asset'
import { createTray } from './core/tray'
import { init } from './resolve/init'
import { addProfileItem, getAppConfig } from './config'
import { join } from 'path'
import {
  startMihomoMemory,
  startMihomoTraffic,
  stopMihomoMemory,
  stopMihomoTraffic
} from './core/mihomoApi'
import { initProfileUpdater } from './core/profileUpdater'

export let window: BrowserWindow | null = null

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  init()
  app.on('second-instance', (_event, commandline) => {
    window?.show()
    window?.focusOnWebView()
    const url = commandline.pop()
    if (url) {
      handleDeepLink(url)
    }
  })
  app.on('open-url', (_event, url) => {
    window?.show()
    window?.focusOnWebView()
    handleDeepLink(url)
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
    startCore().then(() => {
      setTimeout(async () => {
        await initProfileUpdater()
      }, 60000)
    })
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

function handleDeepLink(url: string): void {
  if (url.startsWith('clash://install-config')) {
    url = url.replace('clash://install-config/?url=', '').replace('clash://install-config?url=', '')
    addProfileItem({
      type: 'remote',
      name: 'Remote File',
      url
    })
  }
  if (url.startsWith('mihomo://install-config')) {
    url = url
      .replace('mihomo://install-config/?url=', '')
      .replace('mihomo://install-config?url=', '')
    addProfileItem({
      type: 'remote',
      name: 'Remote File',
      url
    })
  }
}

function createWindow(): void {
  Menu.setApplicationMenu(null)
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
      spellcheck: false,
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
    window?.webContents.reload()
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
