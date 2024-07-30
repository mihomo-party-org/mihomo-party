import { Button, Card, CardBody, CardFooter } from '@nextui-org/react'
import { IoJournal } from 'react-icons/io5'
import { useLocation, useNavigate } from 'react-router-dom'

export default function LogCard(): JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <Card
      className={`w-[50%] ml-1 mb-2 ${location.pathname.includes('/logs') ? 'bg-primary' : ''}`}
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
            <IoJournal color="default" className="text-[20px]" />
          </Button>
        </div>
      </CardBody>
      <CardFooter className="pt-1">
        <h3 className="select-none text-md font-bold">日志</h3>
      </CardFooter>
    </Card>
  )
}
