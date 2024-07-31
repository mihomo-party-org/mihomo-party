import { app, shell, BrowserWindow, Tray, Menu } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import pngIcon from '../../resources/icon.png?asset'
import icoIcon from '../../resources/icon.ico?asset'
import { registerIpcMainHandlers } from './cmds'
import { initConfig, appConfig } from './config'

let window: BrowserWindow | null = null
let tray: Tray | null = null
let trayContextMenu: Menu | null = null

initConfig()

function createWindow(): void {
  // Create the browser window.
  window = new BrowserWindow({
    minWidth: 800,
    minHeight: 600,
    width: 800,
    height: 600,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon: pngIcon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  window.on('ready-to-show', () => {
    if (!appConfig.silentStart) {
      window?.show()
      window?.focusOnWebView()
    }
  })

  window.on('close', (event) => {
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

function createTray(): void {
  if (process.platform === 'linux') {
    tray = new Tray(pngIcon)
  } else {
    tray = new Tray(icoIcon)
  }
  trayContextMenu = Menu.buildFromTemplate([
    {
      label: '显示窗口',
      type: 'normal',
      click: (): void => {
        window?.show()
        window?.focusOnWebView()
      }
    },
    {
      label: '重启应用',
      type: 'normal',
      click: (): void => {
        app.relaunch()
        app.quit()
      }
    },
    { type: 'separator' },
    { label: '退出应用', type: 'normal', click: (): void => app.quit() }
  ])

  tray.setContextMenu(trayContextMenu)
  tray.setIgnoreDoubleClickEvents(true)
  tray.setToolTip('Another Mihomo GUI.')
  tray.setTitle('Mihomo Party')
  tray.addListener('click', () => {
    window?.isVisible() ? window?.hide() : window?.show()
  })
}

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

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  app.exit()
})
