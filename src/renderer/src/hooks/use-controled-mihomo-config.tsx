import useSWR from 'swr'
import { getControledMihomoConfig, patchControledMihomoConfig as patch } from '@renderer/utils/ipc'
import { useEffect } from 'react'

interface RetuenType {
  controledMihomoConfig: Partial<IMihomoConfig> | undefined
  mutateControledMihomoConfig: () => void
  patchControledMihomoConfig: (value: Partial<IMihomoConfig>) => Promise<void>
}

export const useControledMihomoConfig = (listenUpdate = false): RetuenType => {
  const { data: controledMihomoConfig, mutate: mutateControledMihomoConfig } = useSWR(
    'getControledMihomoConfig',
    () => getControledMihomoConfig()
  )

  const patchControledMihomoConfig = async (value: Partial<IMihomoConfig>): Promise<void> => {
    try {
      await patch(value)
    } catch (e) {
      alert(e)
    } finally {
      mutateControledMihomoConfig()
      window.electron.ipcRenderer.send('controledMihomoConfigUpdated')
    }
  }

  useEffect(() => {
    if (!listenUpdate) return
    window.electron.ipcRenderer.on('controledMihomoConfigUpdated', () => {
      mutateControledMihomoConfig()
    })
    return (): void => {
      window.electron.ipcRenderer.removeAllListeners('controledMihomoConfigUpdated')
    }
  }, [])

  return {
    controledMihomoConfig,
    mutateControledMihomoConfig,
    patchControledMihomoConfig
  }
}
