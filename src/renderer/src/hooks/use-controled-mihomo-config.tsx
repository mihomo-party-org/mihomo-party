import useSWR from 'swr'
import { getControledMihomoConfig, setControledMihomoConfig } from '@renderer/utils/ipc'

interface RetuenType {
  controledMihomoConfig: Partial<IMihomoConfig> | undefined
  mutateControledMihomoConfig: () => void
  patchControledMihomoConfig: (value: Partial<IMihomoConfig>) => void
}

export const useControledMihomoConfig = (): RetuenType => {
  const { data: controledMihomoConfig, mutate: mutateControledMihomoConfig } = useSWR(
    'getControledMihomoConfig',
    () => getControledMihomoConfig()
  )

  const patchControledMihomoConfig = async (value: Partial<IMihomoConfig>): Promise<void> => {
    await setControledMihomoConfig(value)
    await mutateControledMihomoConfig()
  }

  return {
    controledMihomoConfig,
    mutateControledMihomoConfig,
    patchControledMihomoConfig
  }
}
