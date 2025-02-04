import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerIpcMainHandlers } from './utils/ipc'
import windowStateKeeper from 'electron-window-state'
import { app, shell, BrowserWindow, Menu, dialog, Notification, powerMonitor } from 'electron'
import { addProfileItem, getAppConfig } from './config'
import { quitWithoutCore, startCore, stopCore } from './core/manager'
import { triggerSysProxy } from './sys/sysproxy'
import icon from '../../resources/icon.png?asset'
import { createTray } from './resolve/tray'
import { init } from './utils/init'
import { join } from 'path'
import { initShortcut } from './resolve/shortcut'
import { execSync, spawn } from 'child_process'
import { createElevateTask } from './sys/misc'
import { initProfileUpdater } from './core/profileUpdater'
import { existsSync, writeFileSync } from 'fs'
import { exePath, taskDir } from './utils/dirs'
import path from 'path'
import { startMonitor } from './resolve/trafficMonitor'
import { showFloatingWindow } from './resolve/floatingWindow'
import iconv from 'iconv-lite'
import { initI18n } from '../shared/i18n'
import i18next from 'i18next'

let quitTimeout: NodeJS.Timeout | null = null
export let mainWindow: BrowserWindow | null = null

if (process.platform === 'win32' && !is.dev && !process.argv.includes('noadmin')) {
  try {
    createElevateTask()
  } catch (createError) {
    try {
      if (process.argv.slice(1).length > 0) {
        writeFileSync(path.join(taskDir(), 'param.txt'), process.argv.slice(1).join(' '))
      } else {
        writeFileSync(path.join(taskDir(), 'param.txt'), 'empty')
      }
      if (!existsSync(path.join(taskDir(), 'mihomo-party-run.exe'))) {
        throw new Error('mihomo-party-run.exe not found')
      } else {
        execSync('%SystemRoot%\\System32\\schtasks.exe /run /tn mihomo-party-run')
      }
    } catch (e) {
      let createErrorStr = `${createError}`
      let eStr = `${e}`
      try {
        createErrorStr = iconv.decode((createError as { stderr: Buffer }).stderr, 'gbk')
        eStr = iconv.decode((e as { stderr: Buffer }).stderr, 'gbk')
      } catch {
        // ignore
      }
      dialog.showErrorBox(
        i18next.t('common.error.adminRequired'),
        `${i18next.t('common.error.adminRequired')}\n${createErrorStr}\n${eStr}`
      )
    } finally {
      app.exit()
    }
  }
}

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
}

export function customRelaunch(): void {
  const script = `while kill -0 ${process.pid} 2>/dev/null; do
  sleep 0.1
done
${process.argv.join(' ')} & disown
exit
`
  spawn('sh', ['-c', `"${script}"`], {
    shell: true,
    detached: true,
    stdio: 'ignore'
  })
}

if (process.platform === 'linux') {
  app.relaunch = customRelaunch
}

if (process.platform === 'win32' && !exePath().startsWith('C')) {
  // https://github.com/electron/electron/issues/43278
  // https://github.com/electron/electron/issues/36698
  app.commandLine.appendSwitch('in-process-gpu')
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

app.on('before-quit', async (e) => {
  e.preventDefault()
  triggerSysProxy(false)
  await stopCore()
  app.exit()
})

powerMonitor.on('shutdown', async () => {
  triggerSysProxy(false)
  await stopCore()
  app.exit()
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('party.mihomo.app')

  try {
    const appConfig = await getAppConfig()
    await initI18n({ lng: appConfig.language })
    await initPromise
  } catch (e) {
    dialog.showErrorBox(i18next.t('common.error.initFailed'), `${e}`)
    app.quit()
  }
  try {
    const [startPromise] = await startCore()
    startPromise.then(async () => {
      await initProfileUpdater()
    })
  } catch (e) {
    dialog.showErrorBox(i18next.t('mihomo.error.coreStartFailed'), `${e}`)
  }
  try {
    await startMonitor()
  } catch {
    // ignore
  }

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })
  const { showFloatingWindow: showFloating = false, disableTray = false } = await getAppConfig()
  registerIpcMainHandlers()
  await createWindow()
  if (showFloating) {
    showFloatingWindow()
  }
  if (!disableTray) {
    await createTray()
  }
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
          throw new Error(i18next.t('profiles.error.urlParamMissing'))
        }
        await addProfileItem({
          type: 'remote',
          name: profileName ?? undefined,
          url: profileUrl
        })
        mainWindow?.webContents.send('profileConfigUpdated')
        new Notification({ title: i18next.t('profiles.notification.importSuccess') }).show()
        break
      } catch (e) {
        dialog.showErrorBox(i18next.t('profiles.error.importFailed'), `${url}\n${e}`)
      }
    }
  }
}

export async function createWindow(): Promise<void> {
  const { useWindowFrame = false } = await getAppConfig()
  const mainWindowState = windowStateKeeper({
    defaultWidth: 800,
    defaultHeight: 600,
    file: 'window-state.json'
  })
  // https://github.com/electron/electron/issues/16521#issuecomment-582955104
  Menu.setApplicationMenu(null)
  mainWindow = new BrowserWindow({
    minWidth: 800,
    minHeight: 600,
    width: mainWindowState.width,
    height: mainWindowState.height,
    x: mainWindowState.x,
    y: mainWindowState.y,
    show: false,
    frame: useWindowFrame,
    fullscreenable: false,
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
      sandbox: false,
      devTools: true
    }
  })
  mainWindowState.manage(mainWindow)
  mainWindow.on('ready-to-show', async () => {
    const {
      silentStart = false,
      autoQuitWithoutCore = false,
      autoQuitWithoutCoreDelay = 60
    } = await getAppConfig()
    if (autoQuitWithoutCore && !mainWindow?.isVisible()) {
      if (quitTimeout) {
        clearTimeout(quitTimeout)
      }
      quitTimeout = setTimeout(async () => {
        await quitWithoutCore()
      }, autoQuitWithoutCoreDelay * 1000)
    }
    if (!silentStart) {
      if (quitTimeout) {
        clearTimeout(quitTimeout)
      }
      mainWindow?.show()
      mainWindow?.focusOnWebView()
    }
  })
  mainWindow.webContents.on('did-fail-load', () => {
    mainWindow?.webContents.reload()
  })

  mainWindow.on('close', async (event) => {
    event.preventDefault()
    mainWindow?.hide()
    const { autoQuitWithoutCore = false, autoQuitWithoutCoreDelay = 60 } = await getAppConfig()
    if (autoQuitWithoutCore) {
      if (quitTimeout) {
        clearTimeout(quitTimeout)
      }
      quitTimeout = setTimeout(async () => {
        await quitWithoutCore()
      }, autoQuitWithoutCoreDelay * 1000)
    }
  })

  mainWindow.on('resized', () => {
    if (mainWindow) mainWindowState.saveState(mainWindow)
  })

  mainWindow.on('move', () => {
    if (mainWindow) mainWindowState.saveState(mainWindow)
  })

  mainWindow.on('session-end', async () => {
    triggerSysProxy(false)
    await stopCore()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // 在开发模式下自动打开 DevTools
  if (is.dev) {
    mainWindow.webContents.openDevTools()
  }

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

export function triggerMainWindow(): void {
  if (mainWindow?.isVisible()) {
    closeMainWindow()
  } else {
    showMainWindow()
  }
}

export function showMainWindow(): void {
  if (mainWindow) {
    if (quitTimeout) {
      clearTimeout(quitTimeout)
    }
    mainWindow.show()
    mainWindow.focusOnWebView()
  }
}

export function closeMainWindow(): void {
  if (mainWindow) {
    mainWindow.close()
  }
}
