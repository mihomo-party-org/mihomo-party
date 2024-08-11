import useSWR from 'swr'
import {
  getProfileConfig,
  setProfileConfig as set,
  addProfileItem as add,
  removeProfileItem as remove,
  updateProfileItem as update,
  changeCurrentProfile as change
} from '@renderer/utils/ipc'
import { useEffect } from 'react'

interface RetuenType {
  profileConfig: IProfileConfig | undefined
  setProfileConfig: (config: IProfileConfig) => Promise<void>
  mutateProfileConfig: () => void
  addProfileItem: (item: Partial<IProfileItem>) => Promise<void>
  updateProfileItem: (item: IProfileItem) => Promise<void>
  removeProfileItem: (id: string) => Promise<void>
  changeCurrentProfile: (id: string) => Promise<void>
}

export const useProfileConfig = (): RetuenType => {
  const { data: profileConfig, mutate: mutateProfileConfig } = useSWR('getProfileConfig', () =>
    getProfileConfig()
  )

  const setProfileConfig = async (config: IProfileConfig): Promise<void> => {
    await set(config)
    mutateProfileConfig()
  }

  const addProfileItem = async (item: Partial<IProfileItem>): Promise<void> => {
    await add(item)
    mutateProfileConfig()
  }

  const removeProfileItem = async (id: string): Promise<void> => {
    await remove(id)
    mutateProfileConfig()
  }

  const updateProfileItem = async (item: IProfileItem): Promise<void> => {
    await update(item)
    mutateProfileConfig()
  }

  const changeCurrentProfile = async (id: string): Promise<void> => {
    await change(id)
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
    setProfileConfig,
    mutateProfileConfig,
    addProfileItem,
    removeProfileItem,
    updateProfileItem,
    changeCurrentProfile
  }
}
