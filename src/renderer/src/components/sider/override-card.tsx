import { Button, Card, CardBody, CardFooter } from '@nextui-org/react'
import React from 'react'
import { MdFormatOverline } from 'react-icons/md'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const OverrideCard: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const match = location.pathname.includes('/override')
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: 'override'
  })
  return (
    <div
      style={{
        position: 'relative',
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 'calc(infinity)' : undefined
      }}
      className="col-span-1"
    >
      <Card
        fullWidth
        className={`col-span-1 ${match ? 'bg-primary' : ''}`}
        isPressable
        onPress={() => navigate('/override')}
      >
        <CardBody className="pb-1 pt-0 px-0">
          <div ref={setNodeRef} {...attributes} {...listeners} className="flex justify-between">
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
