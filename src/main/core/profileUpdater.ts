import { addProfileItem, getCurrentProfileItem, getProfileConfig } from '../config'

const intervalPool: Record<string, NodeJS.Timeout> = {}

export async function initProfileUpdater(): Promise<void> {
  const { items, current } = await getProfileConfig()
  const currentItem = await getCurrentProfileItem()
  for (const item of items.filter((i) => i.id !== current)) {
    if (item.type === 'remote' && item.interval) {
      intervalPool[item.id] = setTimeout(
        async () => {
          try {
            await addProfileItem(item)
          } catch (e) {
            /* ignore */
          }
        },
        item.interval * 60 * 1000
      )
      try {
        await addProfileItem(item)
      } catch (e) {
        /* ignore */
      }
    }
  }
  if (currentItem?.type === 'remote' && currentItem.interval) {
    intervalPool[currentItem.id] = setTimeout(
      async () => {
        try {
          await addProfileItem(currentItem)
        } catch (e) {
          /* ignore */
        }
      },
      currentItem.interval * 60 * 1000 + 10000 // +10s
    )
    try {
      await addProfileItem(currentItem)
    } catch (e) {
      /* ignore */
    }
  }
}

export async function addProfileUpdater(item: IProfileItem): Promise<void> {
  if (item.type === 'remote' && item.interval) {
    if (intervalPool[item.id]) {
      clearTimeout(intervalPool[item.id])
    }
    intervalPool[item.id] = setTimeout(
      async () => {
        try {
          await addProfileItem(item)
        } catch (e) {
          /* ignore */
        }
      },
      item.interval * 60 * 1000
    )
  }
}
