import {
  getAppConfig,
  getControledMihomoConfig,
  patchAppConfig,
  patchControledMihomoConfig
} from '../config'
import icoIcon from '../../../resources/icon.ico?asset'
import pngIcon from '../../../resources/icon.png?asset'
import templateIcon from '../../../resources/iconTemplate.png?asset'
import { patchMihomoConfig } from './mihomoApi'
import { mainWindow, showMainWindow } from '..'
import { app, ipcMain, Menu, nativeImage, shell, Tray } from 'electron'
import { dataDir, logDir, mihomoCoreDir, mihomoWorkDir } from '../utils/dirs'
import { triggerSysProxy } from '../resolve/sysproxy'

export let tray: Tray | null = null

const buildContextMenu = async (): Promise<Menu> => {
  const { mode, tun } = await getControledMihomoConfig()
  const { sysProxy } = await getAppConfig()
  const contextMenu = [
    {
      id: 'show',
      label: '显示窗口',
      type: 'normal',
      click: (): void => {
        showMainWindow()
      }
    },
    {
      id: 'rule',
      label: '规则模式',
      type: 'radio',
      checked: mode === 'rule',
      click: async (): Promise<void> => {
        await patchControledMihomoConfig({ mode: 'rule' })
        await patchMihomoConfig({ mode: 'rule' })
        mainWindow?.webContents.send('controledMihomoConfigUpdated')
        await updateTrayMenu()
      }
    },
    {
      id: 'global',
      label: '全局模式',
      type: 'radio',
      checked: mode === 'global',
      click: async (): Promise<void> => {
        await patchControledMihomoConfig({ mode: 'global' })
        await patchMihomoConfig({ mode: 'global' })
        mainWindow?.webContents.send('controledMihomoConfigUpdated')
        await updateTrayMenu()
      }
    },
    {
      id: 'direct',
      label: '直连模式',
      type: 'radio',
      checked: mode === 'direct',
      click: async (): Promise<void> => {
        await patchControledMihomoConfig({ mode: 'direct' })
        await patchMihomoConfig({ mode: 'direct' })
        mainWindow?.webContents.send('controledMihomoConfigUpdated')
        await updateTrayMenu()
      }
    },
    { type: 'separator' },
    {
      type: 'checkbox',
      label: '系统代理',
      checked: sysProxy.enable,
      click: async (item): Promise<void> => {
        const enable = item.checked
        try {
          await patchAppConfig({ sysProxy: { enable } })
          triggerSysProxy(enable)
        } catch (e) {
          await patchAppConfig({ sysProxy: { enable: !enable } })
        } finally {
          mainWindow?.webContents.send('appConfigUpdated')
          await updateTrayMenu()
        }
      }
    },
    {
      type: 'checkbox',
      label: '虚拟网卡',
      checked: tun?.enable ?? false,
      click: async (item): Promise<void> => {
        const enable = item.checked
        if (enable) {
          await patchControledMihomoConfig({ tun: { enable }, dns: { enable: true } })
        } else {
          await patchControledMihomoConfig({ tun: { enable } })
        }
        await patchMihomoConfig({ tun: { enable } })
        mainWindow?.webContents.send('controledMihomoConfigUpdated')
        await updateTrayMenu()
      }
    },
    { type: 'separator' },
    {
      type: 'submenu',
      label: '打开目录',
      submenu: [
        {
          type: 'normal',
          label: '应用目录',
          click: (): Promise<string> => shell.openPath(dataDir)
        },
        {
          type: 'normal',
          label: '工作目录',
          click: (): Promise<string> => shell.openPath(mihomoWorkDir())
        },
        {
          type: 'normal',
          label: '内核目录',
          click: (): Promise<string> => shell.openPath(mihomoCoreDir())
        },
        {
          type: 'normal',
          label: '日志目录',
          click: (): Promise<string> => shell.openPath(logDir())
        }
      ]
    },
    { type: 'separator' },
    {
      id: 'restart',
      label: '重启应用',
      type: 'normal',
      click: (): void => {
        app.relaunch()
        app.quit()
      }
    },
    { id: 'quit', label: '退出应用', type: 'normal', click: (): void => app.quit() }
  ] as Electron.MenuItemConstructorOptions[]
  return Menu.buildFromTemplate(contextMenu)
}

export async function createTray(): Promise<void> {
  const { useDockIcon = true } = await getAppConfig()
  if (process.platform === 'linux') {
    tray = new Tray(pngIcon)
  }
  if (process.platform === 'darwin') {
    const icon = nativeImage.createFromPath(templateIcon)
    icon.setTemplateImage(true)
    tray = new Tray(icon)
  }
  if (process.platform === 'win32') {
    tray = new Tray(icoIcon)
  }
  const menu = await buildContextMenu()

  ipcMain.on('controledMihomoConfigUpdated', async () => {
    await updateTrayMenu()
  })
  ipcMain.on('appConfigUpdated', async () => {
    await updateTrayMenu()
  })

  tray?.setToolTip('Mihomo Party')
  tray?.setContextMenu(menu)
  tray?.setIgnoreDoubleClickEvents(true)
  if (process.platform === 'darwin') {
    if (!useDockIcon) {
      app.dock.hide()
    } else {
      app.dock.setMenu(menu)
    }
    tray?.addListener('right-click', () => {
      if (mainWindow?.isVisible()) {
        mainWindow?.close()
      } else {
        showMainWindow()
      }
    })
  } else {
    tray?.addListener('click', () => {
      if (mainWindow?.isVisible()) {
        mainWindow?.close()
      } else {
        showMainWindow()
      }
    })
  }
}

async function updateTrayMenu(): Promise<void> {
  const menu = await buildContextMenu()
  if (process.platform === 'darwin') {
    app.dock.setMenu(menu) // 更新dock菜单
  }
  tray?.setContextMenu(menu) // 更新菜单
}
