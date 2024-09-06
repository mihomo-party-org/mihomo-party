import { Button, Card, CardBody, CardFooter } from '@nextui-org/react'
import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { IoLayersOutline } from 'react-icons/io5'
import { useAppConfig } from '@renderer/hooks/use-app-config'
const ResourceCard: React.FC = () => {
  const { appConfig } = useAppConfig()
  const { resourceCardStatus = 'col-span-1' } = appConfig || {}
  const navigate = useNavigate()
  const location = useLocation()
  const match = location.pathname.includes('/resources')
  const {
    attributes,
    listeners,
    setNodeRef,
    transform: tf,
    transition,
    isDragging
  } = useSortable({
    id: 'resource'
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
      className={resourceCardStatus}
    >
      <Card
        fullWidth
        className={`${match ? 'bg-primary' : ''}`}
        isPressable
        onPress={() => navigate('/resources')}
      >
        <CardBody className="pb-1 pt-0 px-0">
          <div ref={setNodeRef} {...attributes} {...listeners} className="flex justify-between">
            <Button
              isIconOnly
              className="bg-transparent pointer-events-none"
              variant="flat"
              color="default"
            >
              <IoLayersOutline
                color="default"
                className={`${match ? 'text-white' : 'text-foreground'} text-[24px] font-bold`}
              />
            </Button>
          </div>
        </CardBody>
        <CardFooter className="pt-1">
          <h3 className={`text-md font-bold ${match ? 'text-white' : 'text-foreground'}`}>
            外部资源
          </h3>
        </CardFooter>
      </Card>
    </div>
  )
}

export default ResourceCard
