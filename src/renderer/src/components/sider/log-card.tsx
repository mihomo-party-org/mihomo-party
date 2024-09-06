import { Button, Card, CardBody, CardFooter } from '@nextui-org/react'
import { IoJournalOutline } from 'react-icons/io5'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useAppConfig } from '@renderer/hooks/use-app-config'
const LogCard: React.FC = () => {
  const { appConfig } = useAppConfig()
  const { logCardStatus = 'col-span-1' } = appConfig || {}
  const navigate = useNavigate()
  const location = useLocation()
  const match = location.pathname.includes('/logs')
  const {
    attributes,
    listeners,
    setNodeRef,
    transform: tf,
    transition,
    isDragging
  } = useSortable({
    id: 'log'
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
      className={logCardStatus}
    >
      <Card
        fullWidth
        className={`${match ? 'bg-primary' : ''}`}
        isPressable
        onPress={() => navigate('/logs')}
      >
        <CardBody className="pb-1 pt-0 px-0">
          <div ref={setNodeRef} {...attributes} {...listeners} className="flex justify-between">
            <Button
              isIconOnly
              className="bg-transparent pointer-events-none"
              variant="flat"
              color="default"
            >
              <IoJournalOutline
                color="default"
                className={`${match ? 'text-white' : 'text-foreground'} text-[24px] font-bold`}
              />
            </Button>
          </div>
        </CardBody>
        <CardFooter className="pt-1">
          <h3 className={`text-md font-bold ${match ? 'text-white' : 'text-foreground'}`}>日志</h3>
        </CardFooter>
      </Card>
    </div>
  )
}

export default LogCard
