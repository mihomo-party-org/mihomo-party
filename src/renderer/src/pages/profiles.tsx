import { Button, Input } from '@nextui-org/react'
import BasePage from '@renderer/components/base/base-page'
import ProfileItem from '@renderer/components/profiles/profile-item'
import { useProfileConfig } from '@renderer/hooks/use-profile-config'
import { getFilePath, readTextFile } from '@renderer/utils/ipc'
import { useEffect, useRef, useState } from 'react'
import { MdContentPaste } from 'react-icons/md'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core'
import { SortableContext } from '@dnd-kit/sortable'

const Profiles: React.FC = () => {
  const {
    profileConfig,
    setProfileConfig,
    addProfileItem,
    updateProfileItem,
    removeProfileItem,
    changeCurrentProfile,
    mutateProfileConfig
  } = useProfileConfig()
  const { current, items = [] } = profileConfig || {}
  const [sortedItems, setSortedItems] = useState(items)
  const [importing, setImporting] = useState(false)
  const [fileOver, setFileOver] = useState(false)
  const [url, setUrl] = useState('')
  const sensors = useSensors(useSensor(PointerSensor))
  const handleImport = async (): Promise<void> => {
    setImporting(true)
    await addProfileItem({ name: '', type: 'remote', url })
    setImporting(false)
  }
  const pageRef = useRef<HTMLDivElement>(null)

  const onDragEnd = async (event: DragEndEvent): Promise<void> => {
    const { active, over } = event
    if (over) {
      if (active.id !== over.id) {
        const newOrder = sortedItems.slice()
        const activeIndex = newOrder.findIndex((item) => item.id === active.id)
        const overIndex = newOrder.findIndex((item) => item.id === over.id)
        newOrder.splice(activeIndex, 1)
        newOrder.splice(overIndex, 0, items[activeIndex])
        setSortedItems(newOrder)
        await setProfileConfig({ current, items: newOrder })
      }
    }
  }

  useEffect(() => {
    pageRef.current?.addEventListener('dragover', (e) => {
      e.preventDefault()
      e.stopPropagation()
      setFileOver(true)
    })
    pageRef.current?.addEventListener('dragleave', (e) => {
      e.preventDefault()
      e.stopPropagation()
      setFileOver(false)
    })
    pageRef.current?.addEventListener('drop', async (event) => {
      event.preventDefault()
      event.stopPropagation()
      if (event.dataTransfer?.files) {
        const file = event.dataTransfer.files[0]
        if (file.name.endsWith('.yml') || file.name.endsWith('.yaml')) {
          try {
            const content = await readTextFile(file.path)
            await addProfileItem({ name: file.name, type: 'local', file: content })
          } catch (e) {
            alert(e)
          }
        } else {
          alert('不支持的文件类型')
        }
      }
      setFileOver(false)
    })
    return (): void => {
      pageRef.current?.removeEventListener('dragover', () => {})
      pageRef.current?.removeEventListener('dragleave', () => {})
      pageRef.current?.removeEventListener('drop', () => {})
    }
  }, [])

  useEffect(() => {
    setSortedItems(items)
  }, [items])

  return (
    <BasePage ref={pageRef} title="订阅管理">
      <div className="sticky top-[48px] z-40 backdrop-blur bg-background/40 flex p-2">
        <Input
          variant="bordered"
          size="sm"
          value={url}
          onValueChange={setUrl}
          endContent={
            <Button
              size="sm"
              isIconOnly
              variant="light"
              onPress={() => {
                navigator.clipboard.readText().then((text) => {
                  setUrl(text)
                })
              }}
            >
              <MdContentPaste className="text-lg" />
            </Button>
          }
        />
        <Button
          size="sm"
          color="primary"
          className="ml-2"
          isDisabled={url === ''}
          isLoading={importing}
          onPress={handleImport}
        >
          导入
        </Button>
        <Button
          size="sm"
          color="primary"
          className="ml-2"
          onPress={async () => {
            try {
              const files = await getFilePath(['yml', 'yaml'])
              if (files?.length) {
                const content = await readTextFile(files[0])
                const fileName = files[0].split('/').pop()?.split('\\').pop()
                await addProfileItem({ name: fileName, type: 'local', file: content })
              }
            } catch (e) {
              alert(e)
            }
          }}
        >
          打开
        </Button>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <div
          className={`${fileOver ? 'blur-sm' : ''} grid sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 mx-2`}
        >
          <SortableContext
            items={sortedItems.map((item) => {
              return item.id
            })}
          >
            {sortedItems.map((item) => (
              <ProfileItem
                key={item.id}
                isCurrent={item.id === current}
                addProfileItem={addProfileItem}
                removeProfileItem={removeProfileItem}
                mutateProfileConfig={mutateProfileConfig}
                updateProfileItem={updateProfileItem}
                info={item}
                onClick={async () => {
                  await changeCurrentProfile(item.id)
                }}
              />
            ))}
          </SortableContext>
        </div>
      </DndContext>
    </BasePage>
  )
}

export default Profiles
