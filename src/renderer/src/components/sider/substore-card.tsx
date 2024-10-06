import { Button, Card, CardBody, CardFooter } from '@nextui-org/react'
import { useLocation } from 'react-router-dom'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import SubStoreIcon from '../base/substore-icon'
import { useAppConfig } from '@renderer/hooks/use-app-config'
const SubStoreCard: React.FC = () => {
  const { appConfig } = useAppConfig()
  const { substoreCardStatus = 'col-span-1', useSubStore = true } = appConfig || {}
  const location = useLocation()
  const match = location.pathname.includes('/substore')
  const {
    attributes,
    listeners,
    setNodeRef,
    transform: tf,
    transition,
    isDragging
  } = useSortable({
    id: 'substore'
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
      className={`${substoreCardStatus} ${!useSubStore ? 'hidden' : ''} substore-card`}
    >
      <Card
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        fullWidth
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
              <SubStoreIcon
                className={`${match ? 'text-primary-foreground' : 'text-foreground'} text-[24px] font-bold`}
              />
            </Button>
          </div>
        </CardBody>
        <CardFooter className="pt-1">
          <h3
            className={`text-md font-bold ${match ? 'text-primary-foreground' : 'text-foreground'}`}
          >
            Sub-Store
          </h3>
        </CardFooter>
      </Card>
    </div>
  )
}

export default SubStoreCard
