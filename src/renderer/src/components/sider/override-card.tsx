import { Button, Card, CardBody, CardFooter } from '@nextui-org/react'
import React from 'react'
import { MdFormatOverline } from 'react-icons/md'
import { useLocation } from 'react-router-dom'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useAppConfig } from '@renderer/hooks/use-app-config'

const OverrideCard: React.FC = () => {
  const { appConfig } = useAppConfig()
  const { overrideCardStatus = 'col-span-1' } = appConfig || {}
  const location = useLocation()
  const match = location.pathname.includes('/override')
  const {
    attributes,
    listeners,
    setNodeRef,
    transform: tf,
    transition,
    isDragging
  } = useSortable({
    id: 'override'
  })
  const transform = tf ? { x: tf.x, y: tf.y, scaleX: 1, scaleY: 1 } : null
  return (
    <div
      ref={setNodeRef} {...attributes} {...listeners}
      style={{
        position: 'relative',
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 'calc(infinity)' : undefined
      }}
      className={overrideCardStatus}
    >
      <Card
        fullWidth
        className={`${match ? 'bg-primary' : ''} ${isDragging ? 'scale-[0.97] tap-highlight-transparent' : ''}`}
      >
        <CardBody className="pb-1 pt-0 px-0">
          <div className="flex justify-between">
            <Button
              isIconOnly
              className="bg-transparent pointer-events-none"
              variant="flat"
              color="default"
            >
              <MdFormatOverline
                color="default"
                className={`${match ? 'text-white' : 'text-foreground'} text-[24px]`}
              />
            </Button>
          </div>
        </CardBody>
        <CardFooter className="pt-1">
          <h3 className={`text-md font-bold ${match ? 'text-white' : 'text-foreground'}`}>覆写</h3>
        </CardFooter>
      </Card>
    </div>
  )
}

export default OverrideCard
