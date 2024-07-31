export async function mihomoVersion(): Promise<IMihomoVersion> {
  return await window.electron.ipcRenderer.invoke('mihomoVersion')
}
