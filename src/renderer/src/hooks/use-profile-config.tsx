import React, { createContext, useContext, ReactNode } from 'react'
import useSWR from 'swr'
import {
  getProfileConfig,
  setProfileConfig as set,
  addProfileItem as add,
  removeProfileItem as remove,
  updateProfileItem as update,
  changeCurrentProfile as change
} from '@renderer/utils/ipc'

interface ProfileConfigContextType {
  profileConfig: IProfileConfig | undefined
  setProfileConfig: (config: IProfileConfig) => Promise<void>
  mutateProfileConfig: () => void
  addProfileItem: (item: Partial<IProfileItem>) => Promise<void>
  updateProfileItem: (item: IProfileItem) => Promise<void>
  removeProfileItem: (id: string) => Promise<void>
  changeCurrentProfile: (id: string) => Promise<void>
}

const ProfileConfigContext = createContext<ProfileConfigContextType | undefined>(undefined)

export const ProfileConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
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
      window.electron.ipcRenderer.send('updateTrayMenu')
    }
  }

  const addProfileItem = async (item: Partial<IProfileItem>): Promise<void> => {
    try {
      await add(item)
    } catch (e) {
      alert(e)
    } finally {
      mutateProfileConfig()
      window.electron.ipcRenderer.send('updateTrayMenu')
    }
  }

  const removeProfileItem = async (id: string): Promise<void> => {
    try {
      await remove(id)
    } catch (e) {
      alert(e)
    } finally {
      mutateProfileConfig()
      window.electron.ipcRenderer.send('updateTrayMenu')
    }
  }

  const updateProfileItem = async (item: IProfileItem): Promise<void> => {
    try {
      await update(item)
    } catch (e) {
      alert(e)
    } finally {
      mutateProfileConfig()
      window.electron.ipcRenderer.send('updateTrayMenu')
    }
  }

  const changeCurrentProfile = async (id: string): Promise<void> => {
    try {
      await change(id)
    } catch (e) {
      alert(e)
    } finally {
      mutateProfileConfig()
      window.electron.ipcRenderer.send('updateTrayMenu')
    }
  }

  React.useEffect(() => {
    window.electron.ipcRenderer.on('profileConfigUpdated', () => {
      mutateProfileConfig()
    })
    return (): void => {
      window.electron.ipcRenderer.removeAllListeners('profileConfigUpdated')
    }
  }, [])

  return (
    <ProfileConfigContext.Provider
      value={{
        profileConfig,
        setProfileConfig,
        mutateProfileConfig,
        addProfileItem,
        removeProfileItem,
        updateProfileItem,
        changeCurrentProfile
      }}
    >
      {children}
    </ProfileConfigContext.Provider>
  )
}

export const useProfileConfig = (): ProfileConfigContextType => {
  const context = useContext(ProfileConfigContext)
  if (context === undefined) {
    throw new Error('useProfileConfig must be used within a ProfileConfigProvider')
  }
  return context
}
