import {
  getAppConfig,
  getControledMihomoConfig,
  patchAppConfig,
  patchControledMihomoConfig
} from '../config'
import icoIcon from '../../../resources/icon.ico?asset'
import pngIcon from '../../../resources/icon.png?asset'
import templateIcon from '../../../resources/iconTemplate.png?asset'
import {
  mihomoChangeProxy,
  mihomoCloseAllConnections,
  mihomoGroups,
  patchMihomoConfig
} from '../core/mihomoApi'
import { mainWindow, showMainWindow } from '..'
import { app, ipcMain, Menu, nativeImage, shell, Tray } from 'electron'
import { dataDir, logDir, mihomoCoreDir, mihomoWorkDir } from '../utils/dirs'
import { triggerSysProxy } from '../sys/sysproxy'

export let tray: Tray | null = null

const buildContextMenu = async (): Promise<Menu> => {
  const { mode, tun } = await getControledMihomoConfig()
  const { sysProxy, autoCloseConnection, proxyInTray = true } = await getAppConfig()
  let groupsMenu: Electron.MenuItemConstructorOptions[] = []
  if (proxyInTray && process.platform !== 'linux') {
    try {
      const groups = await mihomoGroups()
      groupsMenu = groups.map((group) => {
        return {
          id: group.name,
          label: group.name,
          type: 'submenu',
          submenu: group.all.map((proxy) => {
            const delay = proxy.history.length ? proxy.history[proxy.history.length - 1].delay : -1
            let displayDelay = `(${delay}ms)`
            if (delay === -1) {
              displayDelay = ''
            }
            if (delay === 0) {
              displayDelay = '(Timeout)'
            }
            return {
              id: proxy.name,
              label: `${proxy.name}   ${displayDelay}`,
              type: 'radio',
              checked: proxy.name === group.now,
              click: async (): Promise<void> => {
                await mihomoChangeProxy(group.name, proxy.name)
                if (autoCloseConnection) {
                  await mihomoCloseAllConnections()
                }
              }
            }
          })
        }
      })
      groupsMenu.unshift({ type: 'separator' })
    } catch (e) {
      // ignore
      // 避免出错时无法创建托盘菜单
    }
  }

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
    ...groupsMenu,
    { type: 'separator' },
    {
      type: 'submenu',
      label: '打开目录',
      submenu: [
        {
          type: 'normal',
          label: '应用目录',
          click: (): Promise<string> => shell.openPath(dataDir())
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
    const menu = await buildContextMenu()
    tray.setContextMenu(menu)
  }
  if (process.platform === 'darwin') {
    const icon = nativeImage.createFromPath(templateIcon)
    icon.setTemplateImage(true)
    tray = new Tray(icon)
  }
  if (process.platform === 'win32') {
    tray = new Tray(icoIcon)
  }
  tray?.setToolTip('Mihomo Party')
  tray?.setIgnoreDoubleClickEvents(true)
  if (process.platform === 'darwin') {
    if (!useDockIcon) {
      app.dock.hide()
    }
    tray?.addListener('right-click', async () => {
      if (mainWindow?.isVisible()) {
        mainWindow?.close()
      } else {
        showMainWindow()
      }
    })
    tray?.addListener('click', async () => {
      await updateTrayMenu()
    })
  }
  if (process.platform === 'win32') {
    tray?.addListener('click', () => {
      if (mainWindow?.isVisible()) {
        mainWindow?.close()
      } else {
        showMainWindow()
      }
    })
    tray?.addListener('right-click', async () => {
      await updateTrayMenu()
    })
  }
  if (process.platform === 'linux') {
    tray?.addListener('click', () => {
      if (mainWindow?.isVisible()) {
        mainWindow?.close()
      } else {
        showMainWindow()
      }
    })
    ipcMain.on('updateTrayMenu', async () => {
      await updateTrayMenu()
    })
  }
}

async function updateTrayMenu(): Promise<void> {
  const menu = await buildContextMenu()
  tray?.popUpContextMenu(menu) // 弹出菜单
  if (process.platform === 'linux') {
    tray?.setContextMenu(menu)
  }
}
