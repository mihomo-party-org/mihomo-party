import { exec } from 'child_process'
import { promisify } from 'util'
import { getAppConfig, patchControledMihomoConfig } from '../config'
import { patchMihomoConfig } from '../core/mihomoApi'
import { mainWindow } from '..'
import { ipcMain, net } from 'electron'
import { getDefaultDevice } from '../core/manager'

export async function getCurrentSSID(): Promise<string | undefined> {
  if (process.platform === 'win32') {
    try {
      return await getSSIDByNetsh()
    } catch {
      return undefined
    }
  }
  if (process.platform === 'linux') {
    try {
      return await getSSIDByIwconfig()
    } catch {
      return undefined
    }
  }
  if (process.platform === 'darwin') {
    try {
      return await getSSIDByAirport()
    } catch {
      return await getSSIDByNetworksetup()
    }
  }
  return undefined
}

let lastSSID: string | undefined
export async function checkSSID(): Promise<void> {
  try {
    const { pauseSSID = [] } = await getAppConfig()
    if (pauseSSID.length === 0) return
    const currentSSID = await getCurrentSSID()
    if (currentSSID === lastSSID) return
    lastSSID = currentSSID
    if (currentSSID && pauseSSID.includes(currentSSID)) {
      await patchControledMihomoConfig({ mode: 'direct' })
      await patchMihomoConfig({ mode: 'direct' })
      mainWindow?.webContents.send('controledMihomoConfigUpdated')
      ipcMain.emit('updateTrayMenu')
    } else {
      await patchControledMihomoConfig({ mode: 'rule' })
      await patchMihomoConfig({ mode: 'rule' })
      mainWindow?.webContents.send('controledMihomoConfigUpdated')
      ipcMain.emit('updateTrayMenu')
    }
  } catch {
    // ignore
  }
}

export async function startSSIDCheck(): Promise<void> {
  await checkSSID()
  setInterval(checkSSID, 30000)
}

async function getSSIDByAirport(): Promise<string | undefined> {
  const execPromise = promisify(exec)
  const { stdout } = await execPromise(
    '/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport -I'
  )
  if (stdout.trim().startsWith('WARNING')) {
    throw new Error('airport cannot be used')
  }
  for (const line of stdout.split('\n')) {
    if (line.trim().startsWith('SSID')) {
      return line.split(': ')[1].trim()
    }
  }
  return undefined
}

async function getSSIDByNetworksetup(): Promise<string | undefined> {
  const execPromise = promisify(exec)
  if (net.isOnline()) {
    const service = await getDefaultDevice()
    const { stdout } = await execPromise(`networksetup -listpreferredwirelessnetworks ${service}`)
    if (stdout.trim().startsWith('Preferred networks on')) {
      if (stdout.split('\n').length > 1) {
        return stdout.split('\n')[1].trim()
      }
    }
  }
  return undefined
}

async function getSSIDByNetsh(): Promise<string | undefined> {
  const execPromise = promisify(exec)
  const { stdout } = await execPromise('netsh wlan show interfaces')
  for (const line of stdout.split('\n')) {
    if (line.trim().startsWith('SSID')) {
      return line.split(': ')[1].trim()
    }
  }
  return undefined
}

async function getSSIDByIwconfig(): Promise<string | undefined> {
  const execPromise = promisify(exec)
  const { stdout } = await execPromise(
    `iwconfig 2>/dev/null | grep 'ESSID' | awk -F'"' '{print $2}'`
  )
  if (stdout.trim() !== '') {
    return stdout.trim()
  }
  return undefined
}
