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
    try {
      await set(config)
    } catch (e) {
      alert(e)
    } finally {
      mutateOverrideConfig()
    }
  }

  const addOverrideItem = async (item: Partial<IOverrideItem>): Promise<void> => {
    try {
      await add(item)
    } catch (e) {
      alert(e)
    } finally {
      mutateOverrideConfig()
    }
  }

  const removeOverrideItem = async (id: string): Promise<void> => {
    try {
      await remove(id)
    } catch (e) {
      alert(e)
    } finally {
      mutateOverrideConfig()
    }
  }

  const updateOverrideItem = async (item: IOverrideItem): Promise<void> => {
    try {
      await update(item)
    } catch (e) {
      alert(e)
    } finally {
      mutateOverrideConfig()
    }
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
