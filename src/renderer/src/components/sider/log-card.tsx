import { Button, Card, CardBody, CardFooter } from '@nextui-org/react'
import { IoJournal } from 'react-icons/io5'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
const LogCard: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const match = location.pathname.includes('/logs')
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: 'log'
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
              <IoJournal
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
