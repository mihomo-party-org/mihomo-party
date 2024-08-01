import { controledMihomoConfig, setControledMihomoConfig } from './config'
import icoIcon from '../../resources/icon.ico?asset'
import pngIcon from '../../resources/icon.png?asset'
import { patchMihomoConfig } from './mihomo-api'
import { window } from '.'
import { app, ipcMain, Menu, Tray } from 'electron'

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
      checked: controledMihomoConfig.mode === 'rule',
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
      checked: controledMihomoConfig.mode === 'global',
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
      checked: controledMihomoConfig.mode === 'direct',
      click: (): void => {
        setControledMihomoConfig({ mode: 'direct' })
        patchMihomoConfig({ mode: 'direct' })
        window?.webContents.send('controledMihomoConfigUpdated')
        updateTrayMenu()
      }
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
