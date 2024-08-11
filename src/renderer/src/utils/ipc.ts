export async function mihomoVersion(): Promise<IMihomoVersion> {
  return await window.electron.ipcRenderer.invoke('mihomoVersion')
}

export async function mihomoCloseConnection(id: string): Promise<void> {
  return await window.electron.ipcRenderer.invoke('mihomoCloseConnection', id)
}

export async function mihomoCloseAllConnections(): Promise<void> {
  return await window.electron.ipcRenderer.invoke('mihomoCloseAllConnections')
}

export async function mihomoRules(): Promise<IMihomoRulesInfo> {
  return await window.electron.ipcRenderer.invoke('mihomoRules')
}

export async function mihomoProxies(): Promise<IMihomoProxies> {
  return await window.electron.ipcRenderer.invoke('mihomoProxies')
}

export async function mihomoProxyProviders(): Promise<IMihomoProxyProviders> {
  return await window.electron.ipcRenderer.invoke('mihomoProxyProviders')
}

export async function mihomoUpdateProxyProviders(name: string): Promise<void> {
  return await window.electron.ipcRenderer.invoke('mihomoUpdateProxyProviders', name)
}

export async function mihomoRuleProviders(): Promise<IMihomoRuleProviders> {
  return await window.electron.ipcRenderer.invoke('mihomoRuleProviders')
}

export async function mihomoUpdateRuleProviders(name: string): Promise<void> {
  return await window.electron.ipcRenderer.invoke('mihomoUpdateRuleProviders', name)
}

export async function mihomoChangeProxy(group: string, proxy: string): Promise<IMihomoProxy> {
  return await window.electron.ipcRenderer.invoke('mihomoChangeProxy', group, proxy)
}

export async function mihomoUpgradeGeo(): Promise<void> {
  return await window.electron.ipcRenderer.invoke('mihomoUpgradeGeo')
}

export async function mihomoProxyDelay(proxy: string, url?: string): Promise<IMihomoDelay> {
  return await window.electron.ipcRenderer.invoke('mihomoProxyDelay', proxy, url)
}

export async function mihomoGroupDelay(group: string, url?: string): Promise<IMihomoGroupDelay> {
  return await window.electron.ipcRenderer.invoke('mihomoGroupDelay', group, url)
}

export async function startMihomoLogs(): Promise<void> {
  return await window.electron.ipcRenderer.invoke('startMihomoLogs')
}

export async function stopMihomoLogs(): Promise<void> {
  return await window.electron.ipcRenderer.invoke('stopMihomoLogs')
}

export async function startMihomoConnections(): Promise<void> {
  return await window.electron.ipcRenderer.invoke('startMihomoConnections')
}

export async function stopMihomoConnections(): Promise<void> {
  return await window.electron.ipcRenderer.invoke('stopMihomoConnections')
}

export async function patchMihomoConfig(patch: Partial<IMihomoConfig>): Promise<void> {
  return await window.electron.ipcRenderer.invoke('patchMihomoConfig', patch)
}

export async function checkAutoRun(): Promise<boolean> {
  return await window.electron.ipcRenderer.invoke('checkAutoRun')
}

export async function enableAutoRun(): Promise<void> {
  return await window.electron.ipcRenderer.invoke('enableAutoRun')
}

export async function disableAutoRun(): Promise<void> {
  return await window.electron.ipcRenderer.invoke('disableAutoRun')
}

export async function getAppConfig(force = false): Promise<IAppConfig> {
  return await window.electron.ipcRenderer.invoke('getAppConfig', force)
}

export async function setAppConfig(patch: Partial<IAppConfig>): Promise<void> {
  return await window.electron.ipcRenderer.invoke('setAppConfig', patch)
}

export async function getControledMihomoConfig(force = false): Promise<Partial<IMihomoConfig>> {
  return await window.electron.ipcRenderer.invoke('getControledMihomoConfig', force)
}

export async function setControledMihomoConfig(patch: Partial<IMihomoConfig>): Promise<void> {
  return await window.electron.ipcRenderer.invoke('setControledMihomoConfig', patch)
}

export async function getProfileConfig(force = false): Promise<IProfileConfig> {
  return await window.electron.ipcRenderer.invoke('getProfileConfig', force)
}

export async function setProfileConfig(config: IProfileConfig): Promise<void> {
  return await window.electron.ipcRenderer.invoke('setProfileConfig', config)
}

export async function getCurrentProfileItem(): Promise<IProfileItem> {
  return await window.electron.ipcRenderer.invoke('getCurrentProfileItem')
}

export async function getProfileItem(id: string | undefined): Promise<IProfileItem> {
  return await window.electron.ipcRenderer.invoke('getProfileItem', id)
}

export async function changeCurrentProfile(id: string): Promise<void> {
  return await window.electron.ipcRenderer.invoke('changeCurrentProfile', id)
}

export async function addProfileItem(item: Partial<IProfileItem>): Promise<void> {
  return await window.electron.ipcRenderer.invoke('addProfileItem', item)
}

export async function removeProfileItem(id: string): Promise<void> {
  return await window.electron.ipcRenderer.invoke('removeProfileItem', id)
}

export async function updateProfileItem(item: IProfileItem): Promise<void> {
  return await window.electron.ipcRenderer.invoke('updateProfileItem', item)
}

export async function getProfileStr(id: string): Promise<string> {
  return await window.electron.ipcRenderer.invoke('getProfileStr', id)
}

export async function setProfileStr(id: string, str: string): Promise<void> {
  return await window.electron.ipcRenderer.invoke('setProfileStr', id, str)
}

export async function getOverrideConfig(force = false): Promise<IOverrideConfig> {
  return await window.electron.ipcRenderer.invoke('getOverrideConfig', force)
}

export async function setOverrideConfig(config: IOverrideConfig): Promise<void> {
  return await window.electron.ipcRenderer.invoke('setOverrideConfig', config)
}

export async function getOverrideItem(id: string): Promise<IOverrideItem | undefined> {
  return await window.electron.ipcRenderer.invoke('getOverrideItem', id)
}

export async function addOverrideItem(item: Partial<IOverrideItem>): Promise<void> {
  return await window.electron.ipcRenderer.invoke('addOverrideItem', item)
}

export async function removeOverrideItem(id: string): Promise<void> {
  return await window.electron.ipcRenderer.invoke('removeOverrideItem', id)
}

export async function updateOverrideItem(item: IOverrideItem): Promise<void> {
  return await window.electron.ipcRenderer.invoke('updateOverrideItem', item)
}

export async function getOverride(id: string): Promise<string> {
  return await window.electron.ipcRenderer.invoke('getOverride', id)
}

export async function setOverride(id: string, str: string): Promise<void> {
  return await window.electron.ipcRenderer.invoke('setOverride', id, str)
}

export async function restartCore(): Promise<void> {
  return await window.electron.ipcRenderer.invoke('restartCore')
}

export async function triggerSysProxy(enable: boolean): Promise<void> {
  return await window.electron.ipcRenderer.invoke('triggerSysProxy', enable)
}

export async function isEncryptionAvailable(): Promise<boolean> {
  return await window.electron.ipcRenderer.invoke('isEncryptionAvailable')
}

export async function encryptString(str: string): Promise<Buffer> {
  return await window.electron.ipcRenderer.invoke('encryptString', str)
}

export async function getFilePath(ext: string[]): Promise<string[] | undefined> {
  return await window.electron.ipcRenderer.invoke('getFilePath', ext)
}

export async function readTextFile(filePath: string): Promise<string> {
  return await window.electron.ipcRenderer.invoke('readTextFile', filePath)
}

export async function getRuntimeConfigStr(): Promise<string> {
  return await window.electron.ipcRenderer.invoke('getRuntimeConfigStr')
}

export async function getRuntimeConfig(): Promise<IMihomoConfig> {
  return await window.electron.ipcRenderer.invoke('getRuntimeConfig')
}

export async function checkUpdate(): Promise<string | undefined> {
  return await window.electron.ipcRenderer.invoke('checkUpdate')
}

export async function getVersion(): Promise<string> {
  return await window.electron.ipcRenderer.invoke('getVersion')
}

export async function getPlatform(): Promise<NodeJS.Platform> {
  return await window.electron.ipcRenderer.invoke('platform')
}

export async function setupFirewall(): Promise<void> {
  return await window.electron.ipcRenderer.invoke('setupFirewall')
}

export async function quitApp(): Promise<void> {
  return await window.electron.ipcRenderer.invoke('quitApp')
}
