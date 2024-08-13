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
    try {
      await set(config)
    } catch (e) {
      alert(e)
    } finally {
      mutateProfileConfig()
    }
  }

  const addProfileItem = async (item: Partial<IProfileItem>): Promise<void> => {
    try {
      await add(item)
    } catch (e) {
      alert(e)
    } finally {
      mutateProfileConfig()
    }
  }

  const removeProfileItem = async (id: string): Promise<void> => {
    try {
      await remove(id)
    } catch (e) {
      alert(e)
    } finally {
      mutateProfileConfig()
    }
  }

  const updateProfileItem = async (item: IProfileItem): Promise<void> => {
    try {
      await update(item)
    } catch (e) {
      alert(e)
    } finally {
      mutateProfileConfig()
    }
  }

  const changeCurrentProfile = async (id: string): Promise<void> => {
    try {
      await change(id)
    } catch (e) {
      alert(e)
    } finally {
      mutateProfileConfig()
    }
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
