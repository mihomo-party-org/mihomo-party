import React, { createContext, useContext, ReactNode } from 'react'
import useSWR from 'swr'
import { mihomoRules } from '@renderer/utils/ipc'

interface RulesContextType {
  rules: IMihomoRulesInfo | undefined
  mutate: () => void
}

const RulesContext = createContext<RulesContextType | undefined>(undefined)
let emptyRetry = 10

export const RulesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { data: rules, mutate } = useSWR<IMihomoRulesInfo>('mihomoRules', mihomoRules, {
    errorRetryInterval: 200,
    errorRetryCount: 10,
    onSuccess: (data) => {
      if (data.rules.length === 0 && emptyRetry) {
        emptyRetry--
        setTimeout(() => {
          mutate()
        }, 200)
      } else {
        emptyRetry = 10
      }
    }
  })

  React.useEffect(() => {
    window.electron.ipcRenderer.on('coreRestart', () => {
      mutate()
    })
    return (): void => {
      window.electron.ipcRenderer.removeAllListeners('coreRestart')
    }
  }, [])

  return <RulesContext.Provider value={{ rules, mutate }}>{children}</RulesContext.Provider>
}

export const useRules = (): RulesContextType => {
  const context = useContext(RulesContext)
  if (context === undefined) {
    throw new Error('useRules must be used within an RulesProvider')
  }
  return context
}
