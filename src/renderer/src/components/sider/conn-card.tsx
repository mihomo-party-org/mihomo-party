import { Button, Card, CardBody, CardFooter } from '@nextui-org/react'
import { IoLink } from 'react-icons/io5'
import { useLocation, useNavigate } from 'react-router-dom'

const ConnCard: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <Card
      className={`w-[50%] mr-1 mb-2 ${location.pathname.includes('/connections') ? 'bg-primary' : ''}`}
      isPressable
      onPress={() => navigate('/connections')}
    >
      <CardBody className="pb-1 pt-0 px-0">
        <div className="flex justify-between">
          <Button
            isIconOnly
            className="bg-transparent pointer-events-none"
            variant="flat"
            color="default"
          >
            <IoLink color="default" className="text-[20px]" />
          </Button>
        </div>
      </CardBody>
      <CardFooter className="pt-1">
        <h3 className="select-none text-md font-bold">连接</h3>
      </CardFooter>
    </Card>
  )
}

export default ConnCard
