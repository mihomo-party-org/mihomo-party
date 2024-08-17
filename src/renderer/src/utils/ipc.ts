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

export async function mihomoProxyDelay(proxy: string, url?: string): Promise<IMihomoDelay> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('mihomoProxyDelay', proxy, url))
}

export async function mihomoGroupDelay(group: string, url?: string): Promise<IMihomoGroupDelay> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('mihomoGroupDelay', group, url))
}

export async function startMihomoLogs(): Promise<void> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('startMihomoLogs'))
}

export async function stopMihomoLogs(): Promise<void> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('stopMihomoLogs'))
}

export async function startMihomoConnections(): Promise<void> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('startMihomoConnections'))
}

export async function stopMihomoConnections(): Promise<void> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('stopMihomoConnections'))
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

export async function getOverride(id: string, ext: 'js' | 'yaml'): Promise<string> {
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

export async function encryptString(str: string): Promise<Buffer> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('encryptString', str))
}

export async function manualGrantCorePermition(): Promise<void> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('manualGrantCorePermition'))
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

export async function checkUpdate(): Promise<string | undefined> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('checkUpdate'))
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

export async function setPortable(portable: boolean): Promise<void> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('setPortable', portable))
}

export async function isPortable(): Promise<boolean> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('isPortable'))
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

export async function quitApp(): Promise<void> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke('quitApp'))
}
