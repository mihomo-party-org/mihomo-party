import { TitleBarOverlayOptions } from 'electron'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ipcErrorWrapper(response: any): any {
  if (typeof response === 'object' && 'invokeError' in response) {
    throw response.invokeError
  } else {
    return response
  }
}

export async function mihomoVersion(): Promise<IMihomoVersion> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('mihomoVersion'))
}

export async function mihomoCloseConnection(id: string): Promise<void> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('mihomoCloseConnection', id))
}

export async function mihomoCloseAllConnections(): Promise<void> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('mihomoCloseAllConnections'))
}

export async function mihomoRules(): Promise<IMihomoRulesInfo> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('mihomoRules'))
}

export async function mihomoProxies(): Promise<IMihomoProxies> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('mihomoProxies'))
}

export async function mihomoGroups(): Promise<IMihomoMixedGroup[]> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('mihomoGroups'))
}

export async function mihomoProxyProviders(): Promise<IMihomoProxyProviders> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('mihomoProxyProviders'))
}

export async function mihomoUpdateProxyProviders(name: string): Promise<void> {
  return ipcErrorWrapper(
    await window.electron.ipcRenderer.invoke('mihomoUpdateProxyProviders', name)
  )
}

export async function mihomoRuleProviders(): Promise<IMihomoRuleProviders> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('mihomoRuleProviders'))
}

export async function mihomoUpdateRuleProviders(name: string): Promise<void> {
  return ipcErrorWrapper(
    await window.electron.ipcRenderer.invoke('mihomoUpdateRuleProviders', name)
  )
}

export async function mihomoChangeProxy(group: string, proxy: string): Promise<IMihomoProxy> {
  return ipcErrorWrapper(
    await window.electron.ipcRenderer.invoke('mihomoChangeProxy', group, proxy)
  )
}

export async function mihomoUpgradeGeo(): Promise<void> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('mihomoUpgradeGeo'))
}

export async function mihomoUpgrade(): Promise<void> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('mihomoUpgrade'))
}

export async function mihomoProxyDelay(proxy: string, url?: string): Promise<IMihomoDelay> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('mihomoProxyDelay', proxy, url))
}

export async function mihomoGroupDelay(group: string, url?: string): Promise<IMihomoGroupDelay> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('mihomoGroupDelay', group, url))
}

export async function patchMihomoConfig(patch: Partial<IMihomoConfig>): Promise<void> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('patchMihomoConfig', patch))
}

export async function checkAutoRun(): Promise<boolean> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('checkAutoRun'))
}

export async function enableAutoRun(): Promise<void> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('enableAutoRun'))
}

export async function disableAutoRun(): Promise<void> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('disableAutoRun'))
}

export async function getAppConfig(force = false): Promise<IAppConfig> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('getAppConfig', force))
}

export async function patchAppConfig(patch: Partial<IAppConfig>): Promise<void> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('patchAppConfig', patch))
}

export async function getControledMihomoConfig(force = false): Promise<Partial<IMihomoConfig>> {
  return ipcErrorWrapper(
    await window.electron.ipcRenderer.invoke('getControledMihomoConfig', force)
  )
}

export async function patchControledMihomoConfig(patch: Partial<IMihomoConfig>): Promise<void> {
  return ipcErrorWrapper(
    await window.electron.ipcRenderer.invoke('patchControledMihomoConfig', patch)
  )
}

export async function getProfileConfig(force = false): Promise<IProfileConfig> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('getProfileConfig', force))
}

export async function setProfileConfig(config: IProfileConfig): Promise<void> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('setProfileConfig', config))
}

export async function getCurrentProfileItem(): Promise<IProfileItem> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('getCurrentProfileItem'))
}

export async function getProfileItem(id: string | undefined): Promise<IProfileItem> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('getProfileItem', id))
}

export async function changeCurrentProfile(id: string): Promise<void> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('changeCurrentProfile', id))
}

export async function addProfileItem(item: Partial<IProfileItem>): Promise<void> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('addProfileItem', item))
}

export async function removeProfileItem(id: string): Promise<void> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('removeProfileItem', id))
}

export async function updateProfileItem(item: IProfileItem): Promise<void> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('updateProfileItem', item))
}

export async function getProfileStr(id: string): Promise<string> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('getProfileStr', id))
}

export async function setProfileStr(id: string, str: string): Promise<void> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('setProfileStr', id, str))
}

export async function getOverrideConfig(force = false): Promise<IOverrideConfig> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('getOverrideConfig', force))
}

export async function setOverrideConfig(config: IOverrideConfig): Promise<void> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('setOverrideConfig', config))
}

export async function getOverrideItem(id: string): Promise<IOverrideItem | undefined> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('getOverrideItem', id))
}

export async function addOverrideItem(item: Partial<IOverrideItem>): Promise<void> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('addOverrideItem', item))
}

export async function removeOverrideItem(id: string): Promise<void> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('removeOverrideItem', id))
}

export async function updateOverrideItem(item: IOverrideItem): Promise<void> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('updateOverrideItem', item))
}

export async function getOverride(id: string, ext: 'js' | 'yaml' | 'log'): Promise<string> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('getOverride', id, ext))
}

export async function setOverride(id: string, ext: 'js' | 'yaml', str: string): Promise<void> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('setOverride', id, ext, str))
}

export async function restartCore(): Promise<void> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('restartCore'))
}

export async function triggerSysProxy(enable: boolean): Promise<void> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('triggerSysProxy', enable))
}

export async function isEncryptionAvailable(): Promise<boolean> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('isEncryptionAvailable'))
}

export async function encryptString(str: string): Promise<number[]> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('encryptString', str))
}

export async function manualGrantCorePermition(password?: string): Promise<void> {
  return ipcErrorWrapper(
    await window.electron.ipcRenderer.invoke('manualGrantCorePermition', password)
  )
}

export async function getFilePath(ext: string[]): Promise<string[] | undefined> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('getFilePath', ext))
}

export async function readTextFile(filePath: string): Promise<string> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('readTextFile', filePath))
}

export async function getRuntimeConfigStr(): Promise<string> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('getRuntimeConfigStr'))
}

export async function getRuntimeConfig(): Promise<IMihomoConfig> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('getRuntimeConfig'))
}

export async function checkUpdate(): Promise<IAppVersion | undefined> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('checkUpdate'))
}

export async function downloadAndInstallUpdate(version: string): Promise<void> {
  return ipcErrorWrapper(
    await window.electron.ipcRenderer.invoke('downloadAndInstallUpdate', version)
  )
}

export async function getVersion(): Promise<string> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('getVersion'))
}

export async function getPlatform(): Promise<NodeJS.Platform> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('platform'))
}

export async function openUWPTool(): Promise<void> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('openUWPTool'))
}

export async function setupFirewall(): Promise<void> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('setupFirewall'))
}

export async function getInterfaces(): Promise<Record<string, NetworkInterfaceInfo[]>> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('getInterfaces'))
}

export async function webdavBackup(): Promise<boolean> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('webdavBackup'))
}

export async function webdavRestore(filename: string): Promise<void> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('webdavRestore', filename))
}

export async function listWebdavBackups(): Promise<string[]> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('listWebdavBackups'))
}

export async function webdavDelete(filename: string): Promise<void> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('webdavDelete', filename))
}

export async function setTitleBarOverlay(overlay: TitleBarOverlayOptions): Promise<void> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('setTitleBarOverlay', overlay))
}

export async function setAlwaysOnTop(alwaysOnTop: boolean): Promise<void> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('setAlwaysOnTop', alwaysOnTop))
}

export async function isAlwaysOnTop(): Promise<boolean> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('isAlwaysOnTop'))
}

export async function relaunchApp(): Promise<void> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('relaunchApp'))
}

export async function quitApp(): Promise<void> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('quitApp'))
}

export async function setNativeTheme(theme: 'system' | 'light' | 'dark'): Promise<void> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('setNativeTheme', theme))
}

export async function openFile(
  type: 'profile' | 'override',
  id: string,
  ext?: 'yaml' | 'js'
): Promise<void> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('openFile', type, id, ext))
}

export async function registerShortcut(
  oldShortcut: string,
  newShortcut: string,
  action: string
): Promise<boolean> {
  return ipcErrorWrapper(
    await window.electron.ipcRenderer.invoke('registerShortcut', oldShortcut, newShortcut, action)
  )
}

export async function copyEnv(): Promise<void> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('copyEnv'))
}

async function alert<T>(msg: T): Promise<void> {
  const msgStr = typeof msg === 'string' ? msg : JSON.stringify(msg)
  return await window.electron.ipcRenderer.invoke('alert', msgStr)
}

window.alert = alert
