import {
  getAppConfig,
  getControledMihomoConfig,
  setAppConfig,
  setControledMihomoConfig
} from '../config'
import icoIcon from '../../../resources/icon.ico?asset'
import pngIcon from '../../../resources/icon.png?asset'
import { patchMihomoConfig } from './mihomoApi'
import { window } from '..'
import { app, ipcMain, Menu, shell, Tray } from 'electron'
import { dataDir, logDir, mihomoCoreDir, mihomoWorkDir } from '../utils/dirs'
import { triggerSysProxy } from '../resolve/sysproxy'

let tray: Tray | null = null

const buildContextMenu = (): Menu => {
  const contextMenu = [
    {
      id: 'show',
      label: '显示窗口',
      type: 'normal',
      click: (): void => {
        window?.show()
        window?.focusOnWebView()
      }
    },
    {
      id: 'rule',
      label: '规则模式',
      type: 'radio',
      checked: getControledMihomoConfig().mode === 'rule',
      click: (): void => {
        setControledMihomoConfig({ mode: 'rule' })
        patchMihomoConfig({ mode: 'rule' })
        window?.webContents.send('controledMihomoConfigUpdated')
        updateTrayMenu()
      }
    },
    {
      id: 'global',
      label: '全局模式',
      type: 'radio',
      checked: getControledMihomoConfig().mode === 'global',
      click: (): void => {
        setControledMihomoConfig({ mode: 'global' })
        patchMihomoConfig({ mode: 'global' })
        window?.webContents.send('controledMihomoConfigUpdated')
        updateTrayMenu()
      }
    },
    {
      id: 'direct',
      label: '直连模式',
      type: 'radio',
      checked: getControledMihomoConfig().mode === 'direct',
      click: (): void => {
        setControledMihomoConfig({ mode: 'direct' })
        patchMihomoConfig({ mode: 'direct' })
        window?.webContents.send('controledMihomoConfigUpdated')
        updateTrayMenu()
      }
    },
    { type: 'separator' },
    {
      type: 'checkbox',
      label: '系统代理',
      checked: getAppConfig().sysProxy?.enable ?? false,
      click: (item): void => {
        const enable = item.checked
        try {
          triggerSysProxy(enable)
          setAppConfig({ sysProxy: { enable } })
          window?.webContents.send('appConfigUpdated')
        } catch (e) {
          setAppConfig({ sysProxy: { enable: !enable } })
        } finally {
          updateTrayMenu()
        }
      }
    },
    {
      type: 'checkbox',
      label: '虚拟网卡',
      checked: getControledMihomoConfig().tun?.enable ?? false,
      click: (item): void => {
        const enable = item.checked
        if (enable) {
          setControledMihomoConfig({ tun: { enable }, dns: { enable: true } })
        } else {
          setControledMihomoConfig({ tun: { enable } })
        }
        patchMihomoConfig({ tun: { enable } })
        window?.webContents.send('controledMihomoConfigUpdated')
        updateTrayMenu()
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

export function createTray(): void {
  if (process.platform === 'linux') {
    tray = new Tray(pngIcon)
  } else {
    tray = new Tray(icoIcon)
  }
  const menu = buildContextMenu()

  ipcMain.on('controledMihomoConfigUpdated', () => {
    updateTrayMenu()
  })
  ipcMain.on('appConfigUpdated', () => {
    updateTrayMenu()
  })

  tray.setContextMenu(menu)
  tray.setIgnoreDoubleClickEvents(true)
  tray.setToolTip('Another Mihomo GUI.')
  tray.setTitle('Mihomo Party')
  tray.addListener('click', () => {
    window?.isVisible() ? window?.hide() : window?.show()
  })
}

function updateTrayMenu(): void {
  const menu = buildContextMenu()
  tray?.setContextMenu(menu) // 更新菜单
}
