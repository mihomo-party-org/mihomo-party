import { Button, Card, CardBody, CardFooter } from '@nextui-org/react'
import { IoJournal } from 'react-icons/io5'
import { useLocation, useNavigate } from 'react-router-dom'

const LogCard: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const match = location.pathname.includes('/logs')
  return (
    <Card
      className={`w-[50%] mr-1 mb-2 ${match ? 'bg-primary' : ''}`}
      isPressable
      onPress={() => navigate('/logs')}
    >
      <CardBody className="pb-1 pt-0 px-0">
        <div className="flex justify-between">
          <Button
            isIconOnly
            className="bg-transparent pointer-events-none"
            variant="flat"
            color="default"
          >
            <IoJournal
              color="default"
              className={`${match ? 'text-white' : 'text-foreground'} text-[20px] font-bold`}
            />
          </Button>
        </div>
      </CardBody>
      <CardFooter className="pt-1">
        <h3 className={`select-none text-md font-bold ${match ? 'text-white' : 'text-foreground'}`}>
          日志
        </h3>
      </CardFooter>
    </Card>
  )
}

export default LogCard
