import { Button, Card, CardBody, CardFooter, Chip } from '@nextui-org/react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { LuGroup } from 'react-icons/lu'
import { useLocation } from 'react-router-dom'
import { useGroups } from '@renderer/hooks/use-groups'
import { useAppConfig } from '@renderer/hooks/use-app-config'

const ProxyCard: React.FC = () => {
  const { appConfig } = useAppConfig()
  const { proxyCardStatus = 'col-span-1' } = appConfig || {}
  const location = useLocation()
  const match = location.pathname.includes('/proxies')
  const { groups = [] } = useGroups()
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

  return (
    <div
      style={{
        position: 'relative',
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 'calc(infinity)' : undefined
      }}
      className={`${proxyCardStatus} proxy-card`}
    >
      <Card
        fullWidth
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        className={`${match ? 'bg-primary' : 'hover:bg-primary/30'} ${isDragging ? 'scale-[0.97] tap-highlight-transparent' : ''}`}
      >
        <CardBody className="pb-1 pt-0 px-0">
          <div className="flex justify-between">
            <Button
              isIconOnly
              className="bg-transparent pointer-events-none"
              variant="flat"
              color="default"
            >
              <LuGroup
                className={`${match ? 'text-primary-foreground' : 'text-foreground'} text-[24px] font-bold`}
              />
            </Button>
            <Chip
              classNames={
                match
                  ? {
                      base: 'border-primary-foreground',
                      content: 'text-primary-foreground'
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
              {groups.length}
            </Chip>
          </div>
        </CardBody>
        <CardFooter className="pt-1">
          <h3
            className={`text-md font-bold ${match ? 'text-primary-foreground' : 'text-foreground'}`}
          >
            代理组
          </h3>
        </CardFooter>
      </Card>
    </div>
  )
}

export default ProxyCard
