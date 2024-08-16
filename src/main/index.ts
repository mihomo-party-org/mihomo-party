import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerIpcMainHandlers } from './utils/ipc'
import windowStateKeeper from 'electron-window-state'
import { app, shell, BrowserWindow, Menu, dialog, Notification } from 'electron'
import { startMihomoMemory, stopMihomoMemory } from './core/mihomoApi'
import { addProfileItem, getAppConfig } from './config'
import { stopCore } from './core/manager'
import { triggerSysProxy } from './sys/sysproxy'
import icon from '../../resources/icon.png?asset'
import { createTray } from './resolve/tray'
import { init } from './utils/init'
import { join } from 'path'

export let mainWindow: BrowserWindow | null = null

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
}
const initPromise = init()

app.on('second-instance', async (_event, commandline) => {
  showMainWindow()
  const url = commandline.pop()
  if (url) {
    await handleDeepLink(url)
  }
})

app.on('open-url', async (_event, url) => {
  showMainWindow()
  await handleDeepLink(url)
})
// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', (e) => {
  e.preventDefault()
  // if (process.platform !== 'darwin') {
  //   app.quit()
  // }
})

app.on('before-quit', () => {
  stopCore()
  triggerSysProxy(false)
  app.exit()
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('party.mihomo.app')
  try {
    await initPromise
  } catch (e) {
    dialog.showErrorBox('应用初始化失败', `${e}`)
    app.quit()
  }

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })
  registerIpcMainHandlers()
  createWindow()
  await createTray()
  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    showMainWindow()
  })
})

async function handleDeepLink(url: string): Promise<void> {
  try {
    if (url.startsWith('clash://install-config')) {
      url = url
        .replace('clash://install-config/?url=', '')
        .replace('clash://install-config?url=', '')
    }
    if (url.startsWith('mihomo://install-config')) {
      url = url
        .replace('mihomo://install-config/?url=', '')
        .replace('mihomo://install-config?url=', '')
    }
    url = decodeURIComponent(url.split('&')[0])
    await addProfileItem({
      type: 'remote',
      name: 'Remote File',
      url: decodeURIComponent(url)
    })
    new Notification({ title: '订阅导入成功' }).show()
  } catch (e) {
    dialog.showErrorBox('订阅导入失败', `${url}\n${e}`)
  }
}

export function createWindow(show = false): void {
  Menu.setApplicationMenu(null)
  // Create the browser window.
  const mainWindowState = windowStateKeeper({
    defaultWidth: 800,
    defaultHeight: 600
  })
  mainWindow = new BrowserWindow({
    minWidth: 800,
    minHeight: 600,
    width: mainWindowState.width,
    height: mainWindowState.height,
    x: mainWindowState.x,
    y: mainWindowState.y,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon: icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      spellcheck: false,
      sandbox: false
    }
  })
  mainWindowState.manage(mainWindow)
  mainWindow.on('ready-to-show', async () => {
    const { silentStart } = await getAppConfig()
    if (!silentStart || show) {
      mainWindow?.show()
      mainWindow?.focusOnWebView()
    }
  })

  mainWindow.on('resize', () => {
    mainWindow?.webContents.send('resize')
  })

  mainWindow.on('show', () => {
    startMihomoMemory()
  })

  mainWindow.on('close', (event) => {
    event.preventDefault()
    stopMihomoMemory()
    mainWindow?.hide()
    mainWindow?.reload()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

export function showMainWindow(): void {
  if (mainWindow) {
    mainWindow.show()
    mainWindow.focusOnWebView()
  } else {
    createWindow(true)
  }
}
