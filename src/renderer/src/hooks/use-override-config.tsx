import useSWR from 'swr'
import {
  getOverrideConfig,
  setOverrideConfig as set,
  addOverrideItem as add,
  removeOverrideItem as remove,
  updateOverrideItem as update
} from '@renderer/utils/ipc'

interface RetuenType {
  overrideConfig: IOverrideConfig | undefined
  setOverrideConfig: (config: IOverrideConfig) => Promise<void>
  mutateOverrideConfig: () => void
  addOverrideItem: (item: Partial<IOverrideItem>) => Promise<void>
  updateOverrideItem: (item: IOverrideItem) => Promise<void>
  removeOverrideItem: (id: string) => Promise<void>
}

export const useOverrideConfig = (): RetuenType => {
  const { data: overrideConfig, mutate: mutateOverrideConfig } = useSWR('getOverrideConfig', () =>
    getOverrideConfig()
  )

  const setOverrideConfig = async (config: IOverrideConfig): Promise<void> => {
    await set(config)
    mutateOverrideConfig()
  }

  const addOverrideItem = async (item: Partial<IOverrideItem>): Promise<void> => {
    await add(item)
    mutateOverrideConfig()
  }

  const removeOverrideItem = async (id: string): Promise<void> => {
    await remove(id)
    mutateOverrideConfig()
  }

  const updateOverrideItem = async (item: IOverrideItem): Promise<void> => {
    await update(item)
    mutateOverrideConfig()
  }

  return {
    overrideConfig,
    setOverrideConfig,
    mutateOverrideConfig,
    addOverrideItem,
    removeOverrideItem,
    updateOverrideItem
  }
}
