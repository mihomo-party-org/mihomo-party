import { addProfileItem, getProfileConfig, getProfileItem } from '../config'

const intervalPool: Record<string, NodeJS.Timeout> = {}

export function initProfileUpdater(): void {
  const { items } = getProfileConfig()

  for (const item of items) {
    if (item.type === 'remote' && item.interval) {
      addProfileItem(getProfileItem(item.id))
      intervalPool[item.id] = setInterval(
        () => {
          addProfileItem(getProfileItem(item.id))
        },
        item.interval * 60 * 1000
      )
    }
  }
}

export function addProfileUpdater(id: string): void {
  const { items } = getProfileConfig()
  const item = items.find((i) => i.id === id)

  if (item?.type === 'remote' && item.interval) {
    if (intervalPool[id]) {
      clearInterval(intervalPool[id])
    }
    intervalPool[id] = setInterval(
      () => {
        addProfileItem(getProfileItem(id))
      },
      item.interval * 60 * 1000
    )
  }
}
