import React, { createContext, useContext, ReactNode } from 'react'
import useSWR from 'swr'
import { mihomoGroups, mihomoProxies } from '@renderer/utils/ipc'

interface GroupsContextType {
  groups: IMihomoMixedGroup[] | undefined
  proxies: IMihomoProxies | undefined
  mutate: () => void
}

const GroupsContext = createContext<GroupsContextType | undefined>(undefined)

export const GroupsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { data: groups, mutate: mutateG } = useSWR<IMihomoMixedGroup[]>(
    'mihomoGroups',
    mihomoGroups,
    {
      errorRetryInterval: 200,
      errorRetryCount: 10
    }
  )
  const { data: proxies, mutate: mutateP } = useSWR('mihomoProxies', mihomoProxies, {
    errorRetryInterval: 200,
    errorRetryCount: 10
  })

  const mutate = (): void => {
    mutateG()
    mutateP()
  }
  React.useEffect(() => {
    window.electron.ipcRenderer.on('groupsUpdated', () => {
      mutate()
    })
    return (): void => {
      window.electron.ipcRenderer.removeAllListeners('groupsUpdated')
    }
  }, [])

  return (
    <GroupsContext.Provider value={{ groups, proxies, mutate }}>{children}</GroupsContext.Provider>
  )
}

export const useGroups = (): GroupsContextType => {
  const context = useContext(GroupsContext)
  if (context === undefined) {
    throw new Error('useGroups must be used within an GroupsProvider')
  }
  return context
}
