import { addProfileItem, getCurrentProfileItem, getProfileConfig, getProfileItem } from '../config'

const intervalPool: Record<string, NodeJS.Timeout> = {}

export async function initProfileUpdater(): Promise<void> {
  const { items, current } = getProfileConfig()
  const currentItem = getCurrentProfileItem()
  for (const item of items.filter((i) => i.id !== current)) {
    if (item.type === 'remote' && item.interval) {
      await addProfileItem(item)
      intervalPool[item.id] = setInterval(
        async () => {
          await addProfileItem(item)
        },
        item.interval * 60 * 1000
      )
    }
  }
  if (currentItem.type === 'remote' && currentItem.interval) {
    await addProfileItem(currentItem)
    intervalPool[currentItem.id] = setInterval(
      async () => {
        await addProfileItem(currentItem)
      },
      currentItem.interval * 60 * 1000 + 10000 // +10s
    )
  }
}

export function addProfileUpdater(id: string): void {
  const item = getProfileItem(id)

  if (item.type === 'remote' && item.interval) {
    if (intervalPool[id]) {
      clearInterval(intervalPool[id])
    }
    intervalPool[id] = setInterval(
      async () => {
        await addProfileItem(item)
      },
      item.interval * 60 * 1000
    )
  }
}
