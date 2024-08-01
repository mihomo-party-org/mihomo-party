import { Button, Card, CardBody, CardFooter, Switch } from '@nextui-org/react'
import React, { useState } from 'react'
import { AiOutlineGlobal } from 'react-icons/ai'
import { useLocation, useNavigate } from 'react-router-dom'

const SysproxySwitcher: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const match = location.pathname.includes('/sysproxy')
  const [enable, setEnable] = useState(false)

  return (
    <Card
      className={`w-[50%] mr-1 ${match ? 'bg-primary' : ''}`}
      isPressable
      onPress={() => navigate('/sysproxy')}
    >
      <CardBody className="pb-1 pt-0 px-0">
        <div className="flex justify-between">
          <Button
            isIconOnly
            className="bg-transparent pointer-events-none"
            variant="flat"
            color="default"
          >
            <AiOutlineGlobal color="default" className="text-[24px]" />
          </Button>
          <Switch
            classNames={{ wrapper: `${match && enable ? 'border-2' : ''}` }}
            size="sm"
            isSelected={enable}
            onValueChange={setEnable}
          />
        </div>
      </CardBody>
      <CardFooter className="pt-1">
        <h3 className="select-none text-md font-bold">系统代理</h3>
      </CardFooter>
    </Card>
  )
}

export default SysproxySwitcher
