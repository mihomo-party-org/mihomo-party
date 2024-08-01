export async function mihomoVersion(): Promise<IMihomoVersion> {
  return await window.electron.ipcRenderer.invoke('mihomoVersion')
}

export async function mihomoConfig(): Promise<IMihomoConfig> {
  return await window.electron.ipcRenderer.invoke('mihomoConfig')
}

export async function patchMihomoConfig(patch: Partial<IMihomoConfig>): Promise<void> {
  await window.electron.ipcRenderer.invoke('patchMihomoConfig', patch)
}

export async function checkAutoRun(): Promise<boolean> {
  return await window.electron.ipcRenderer.invoke('checkAutoRun')
}

export async function enableAutoRun(): Promise<void> {
  await window.electron.ipcRenderer.invoke('enableAutoRun')
}

export async function disableAutoRun(): Promise<void> {
  await window.electron.ipcRenderer.invoke('disableAutoRun')
}

export async function getAppConfig(force = false): Promise<IAppConfig> {
  return await window.electron.ipcRenderer.invoke('getAppConfig', force)
}

export async function setAppConfig(patch: Partial<IAppConfig>): Promise<void> {
  await window.electron.ipcRenderer.invoke('setAppConfig', patch)
}

export async function getControledMihomoConfig(force = false): Promise<Partial<IMihomoConfig>> {
  return await window.electron.ipcRenderer.invoke('getControledMihomoConfig', force)
}

export async function setControledMihomoConfig(patch: Partial<IMihomoConfig>): Promise<void> {
  await window.electron.ipcRenderer.invoke('setControledMihomoConfig', patch)
}

export async function restartCore(): Promise<void> {
  await window.electron.ipcRenderer.invoke('restartCore')
}
