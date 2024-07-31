import { Button, Card, CardBody, CardFooter, Switch } from '@nextui-org/react'
import { MdFormatOverline } from 'react-icons/md'
import { useLocation, useNavigate } from 'react-router-dom'

export default function OverrideCard(): JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <Card
      className={`w-[50%] ml-1 mb-2 ${location.pathname.includes('/override') ? 'bg-primary' : ''}`}
      isPressable
      onPress={() => navigate('/override')}
    >
      <CardBody className="pb-1 pt-0 px-0">
        <div className="flex justify-between">
          <Button
            isIconOnly
            className="bg-transparent pointer-events-none"
            variant="flat"
            color="default"
          >
            <MdFormatOverline color="default" className="text-[24px]" />
          </Button>
          <Switch size="sm" />
        </div>
      </CardBody>
      <CardFooter className="pt-1">
        <h3 className="select-none text-md font-bold">覆写</h3>
      </CardFooter>
    </Card>
  )
}
