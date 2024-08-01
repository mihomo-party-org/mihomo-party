import useSWR from 'swr'
import { getAppConfig, setAppConfig } from '@renderer/utils/ipc'
import { useEffect } from 'react'

interface RetuenType {
  appConfig: IAppConfig | undefined
  mutateAppConfig: () => void
  patchAppConfig: (value: Partial<IAppConfig>) => Promise<void>
}

export const useAppConfig = (): RetuenType => {
  const { data: appConfig, mutate: mutateAppConfig } = useSWR('getConfig', () => getAppConfig())

  const patchAppConfig = async (value: Partial<IAppConfig>): Promise<void> => {
    await setAppConfig(value)
    mutateAppConfig()
    window.electron.ipcRenderer.send('appConfigUpdated')
  }

  useEffect(() => {
    window.electron.ipcRenderer.on('appConfigUpdated', () => {
      mutateAppConfig()
    })
    return (): void => {
      window.electron.ipcRenderer.removeAllListeners('appConfigUpdated')
    }
  }, [])

  return {
    appConfig,
    mutateAppConfig,
    patchAppConfig
  }
}
