import useSWR from 'swr'
import { getAppConfig, setAppConfig } from '@renderer/utils/ipc'

interface RetuenType {
  appConfig: IAppConfig | undefined
  mutateAppConfig: () => void
  patchAppConfig: (value: Partial<IAppConfig>) => Promise<void>
}

export const useAppConfig = (): RetuenType => {
  const { data: appConfig, mutate: mutateAppConfig } = useSWR('getConfig', () => getAppConfig())

  const patchAppConfig = async (value: Partial<IAppConfig>): Promise<void> => {
    await setAppConfig(value)
    await mutateAppConfig()
  }

  return {
    appConfig,
    mutateAppConfig,
    patchAppConfig
  }
}
