export async function mihomoVersion(): Promise<IMihomoVersion> {
  return await window.electron.ipcRenderer.invoke('mihomoVersion')
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
