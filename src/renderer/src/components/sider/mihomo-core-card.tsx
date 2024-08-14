import { Button, Card, CardBody, CardFooter } from '@nextui-org/react'
import { calcTraffic } from '@renderer/utils/calc'
import { mihomoVersion, restartCore } from '@renderer/utils/ipc'
import { useEffect, useState } from 'react'
import { IoMdRefresh } from 'react-icons/io'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useLocation, useNavigate } from 'react-router-dom'
import useSWR from 'swr'

const MihomoCoreCard: React.FC = () => {
  const { data: version, mutate } = useSWR('mihomoVersion', mihomoVersion)
  const navigate = useNavigate()
  const location = useLocation()
  const match = location.pathname.includes('/mihomo')
  const {
    attributes,
    listeners,
    setNodeRef,
    transform: tf,
    transition,
    isDragging
  } = useSortable({
    id: 'mihomo'
  })
  const transform = tf ? { x: tf.x, y: tf.y, scaleX: 1, scaleY: 1 } : null
  const [mem, setMem] = useState(0)

  useEffect(() => {
    const token = PubSub.subscribe('mihomo-core-changed', () => {
      mutate()
    })
    window.electron.ipcRenderer.on('mihomoMemory', (_e, info: IMihomoMemoryInfo) => {
      setMem(info.inuse)
    })
    return (): void => {
      PubSub.unsubscribe(token)
      window.electron.ipcRenderer.removeAllListeners('mihomoMemory')
    }
  }, [])

  return (
    <div
      style={{
        position: 'relative',
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 'calc(infinity)' : undefined
      }}
      className="col-span-2"
    >
      <Card
        fullWidth
        isPressable
        onPress={() => navigate('/mihomo')}
        className={`${match ? 'bg-primary' : ''}`}
      >
        <CardBody>
          <div
            ref={setNodeRef}
            {...attributes}
            {...listeners}
            className="flex justify-between h-[32px]"
          >
            <h3
              className={`text-md font-bold leading-[32px] ${match ? 'text-white' : 'text-foreground'} `}
            >
              {version?.version ?? '-'}
            </h3>

            <Button
              isIconOnly
              size="sm"
              variant="light"
              color="default"
              onPress={async () => {
                try {
                  await restartCore()
                } catch (e) {
                  alert(e)
                } finally {
                  mutate()
                }
              }}
            >
              <IoMdRefresh className={`${match ? 'text-white' : 'text-foreground'} text-[24px]`} />
            </Button>
          </div>
        </CardBody>
        <CardFooter className="pt-1">
          <div
            className={`flex justify-between w-full text-md font-bold ${match ? 'text-white' : 'text-foreground'}`}
          >
            <h4>内核设置</h4>
            <h4>{calcTraffic(mem)}</h4>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}

export default MihomoCoreCard
