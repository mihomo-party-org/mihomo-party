import useSWR from 'swr'
import {
  getProfileConfig,
  addProfileItem as add,
  removeProfileItem as remove
} from '@renderer/utils/ipc'
import { useEffect } from 'react'

interface RetuenType {
  profileConfig: IProfileConfig | undefined
  mutateProfileConfig: () => void
  addProfileItem: (item: Partial<IProfileItem>) => Promise<void>
  removeProfileItem: (id: string) => void
}

export const useProfileConfig = (): RetuenType => {
  const { data: profileConfig, mutate: mutateProfileConfig } = useSWR('getProfileConfig', () =>
    getProfileConfig()
  )

  const addProfileItem = async (item: Partial<IProfileItem>): Promise<void> => {
    await add(item)
    mutateProfileConfig()
  }

  const removeProfileItem = async (id: string): Promise<void> => {
    await remove(id)
    mutateProfileConfig()
  }
  useEffect(() => {
    window.electron.ipcRenderer.on('profileConfigUpdated', () => {
      mutateProfileConfig()
    })
    return (): void => {
      window.electron.ipcRenderer.removeAllListeners('profileConfigUpdated')
    }
  }, [])

  return {
    profileConfig,
    mutateProfileConfig,
    addProfileItem,
    removeProfileItem
  }
}
