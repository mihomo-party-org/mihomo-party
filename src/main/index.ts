import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerIpcMainHandlers } from './utils/ipc'
import windowStateKeeper from 'electron-window-state'
import { app, shell, BrowserWindow, Menu, dialog, Notification } from 'electron'
import { pauseWebsockets, startMihomoMemory, stopMihomoMemory } from './core/mihomoApi'
import { addProfileItem, getAppConfig } from './config'
import { startCore, stopCore } from './core/manager'
import { triggerSysProxy } from './sys/sysproxy'
import icon from '../../resources/icon.png?asset'
import { createTray } from './resolve/tray'
import { init } from './utils/init'
import { join } from 'path'
import { initShortcut } from './resolve/shortcut'
import { execSync } from 'child_process'
import { createElevateTask } from './sys/misc'
import { initProfileUpdater } from './core/profileUpdater'
import { existsSync, writeFileSync } from 'fs'
import { taskDir } from './utils/dirs'
import path from 'path'

export let mainWindow: BrowserWindow | null = null
if (process.platform === 'win32' && !is.dev) {
  try {
    createElevateTask()
  } catch (e) {
    try {
      if (process.argv.slice(1).length > 0) {
        writeFileSync(path.join(taskDir(), 'param.txt'), process.argv.slice(1).join(' '))
      } else {
        writeFileSync(path.join(taskDir(), 'param.txt'), 'empty')
      }
      if (!existsSync(path.join(taskDir(), 'mihomo-party-run.exe'))) {
        throw new Error('mihomo-party-run.exe not found')
      } else {
        execSync('schtasks /run /tn mihomo-party-run')
      }
    } catch (e) {
      dialog.showErrorBox('首次启动请以管理员权限运行', '首次启动请以管理员权限运行')
    } finally {
      app.exit()
    }
  }
}

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

app.on('before-quit', async () => {
  pauseWebsockets()
  await stopCore()
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
  try {
    const [startPromise] = await startCore()
    startPromise.then(async () => {
      await initProfileUpdater()
    })
  } catch (e) {
    dialog.showErrorBox('内核启动出错', `${e}`)
  }

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })
  registerIpcMainHandlers()
  await createWindow()
  await createTray()
  await initShortcut()
  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    showMainWindow()
  })
})

async function handleDeepLink(url: string): Promise<void> {
  if (!url.startsWith('clash://') && !url.startsWith('mihomo://')) return

  const urlObj = new URL(url)
  switch (urlObj.host) {
    case 'install-config': {
      try {
        const profileUrl = urlObj.searchParams.get('url')
        const profileName = urlObj.searchParams.get('name')
        if (!profileUrl) {
          throw new Error('缺少参数 url')
        }
        await addProfileItem({
          type: 'remote',
          name: profileName ?? undefined,
          url: profileUrl
        })
        mainWindow?.webContents.send('profileConfigUpdated')
        new Notification({ title: '订阅导入成功' }).show()
        break
      } catch (e) {
        dialog.showErrorBox('订阅导入失败', `${url}\n${e}`)
      }
    }
  }
}

export async function createWindow(): Promise<void> {
  Menu.setApplicationMenu(null)
  const { useWindowFrame = true } = await getAppConfig()
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
    frame: useWindowFrame,
    titleBarStyle: useWindowFrame ? 'default' : 'hidden',
    titleBarOverlay: useWindowFrame
      ? false
      : {
          height: 49
        },
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
    if (!silentStart) {
      mainWindow?.show()
      mainWindow?.focusOnWebView()
    }
  })
  mainWindow.webContents.on('did-fail-load', () => {
    mainWindow?.webContents.reload()
  })

  mainWindow.on('show', () => {
    startMihomoMemory()
  })

  mainWindow.on('close', (event) => {
    event.preventDefault()
    stopMihomoMemory()
    mainWindow?.hide()
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
  }
}
