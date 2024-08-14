import { Button, Card, CardBody, CardFooter, Chip } from '@nextui-org/react'
import { mihomoProxies } from '@renderer/utils/ipc'
import { useMemo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { LuGroup } from 'react-icons/lu'
import { useLocation, useNavigate } from 'react-router-dom'
import useSWR from 'swr'

const ProxyCard: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const match = location.pathname.includes('/proxies')
  const { data: proxies } = useSWR('mihomoProxies', mihomoProxies)
  const {
    attributes,
    listeners,
    setNodeRef,
    transform: tf,
    transition,
    isDragging
  } = useSortable({
    id: 'proxy'
  })
  const transform = tf ? { x: tf.x, y: tf.y, scaleX: 1, scaleY: 1 } : null
  const filtered = useMemo(() => {
    if (!proxies) return []
    if (!proxies.proxies) return []
    return Object.keys(proxies.proxies).filter((key) => 'all' in proxies.proxies[key])
  }, [proxies])

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
        className={`${match ? 'bg-primary' : ''}`}
        isPressable
        onPress={() => navigate('/proxies')}
      >
        <CardBody className="pb-1 pt-0 px-0">
          <div ref={setNodeRef} {...attributes} {...listeners} className="flex justify-between">
            <Button
              isIconOnly
              className="bg-transparent pointer-events-none"
              variant="flat"
              color="default"
            >
              <LuGroup
                className={`${match ? 'text-white' : 'text-foreground'} text-[24px] font-bold`}
              />
            </Button>
            <Chip
              classNames={
                match
                  ? {
                      base: 'border-white',
                      content: 'text-white'
                    }
                  : {
                      base: 'border-primary',
                      content: 'text-primary'
                    }
              }
              size="sm"
              variant="bordered"
              className="mr-2 mt-2"
            >
              {filtered.length}
            </Chip>
          </div>
        </CardBody>
        <CardFooter className="pt-1">
          <h3 className={`text-md font-bold ${match ? 'text-white' : 'text-foreground'}`}>
            代理组
          </h3>
        </CardFooter>
      </Card>
    </div>
  )
}

export default ProxyCard
