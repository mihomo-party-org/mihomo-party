import { Button, Card, CardBody, CardFooter, Slider } from '@nextui-org/react'
import { IoMdRefresh } from 'react-icons/io'
import { useLocation, useNavigate } from 'react-router-dom'

export default function ProfileCard(): JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <Card
      fullWidth
      className={`mb-2 ${location.pathname.includes('/profiles') ? 'bg-primary' : ''}`}
      isPressable
      onPress={() => navigate('/profiles')}
    >
      <CardBody>
        <div className="flex justify-between h-[32px]">
          <h3 className="select-none text-md font-bold leading-[32px]">订阅名称</h3>
          <Button isIconOnly size="sm" variant="light" color="default">
            <IoMdRefresh color="default" className="text-[24px]" />
          </Button>
        </div>
      </CardBody>
      <CardFooter className="pt-1">
        <Slider className="pointer-events-none" color="foreground" value={20} hideThumb />
      </CardFooter>
    </Card>
  )
}
