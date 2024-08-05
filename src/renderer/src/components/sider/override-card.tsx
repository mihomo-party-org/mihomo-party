import { Button, Card, CardBody, CardFooter } from '@nextui-org/react'
import BorderSwitch from '@renderer/components/base/border-swtich'
import React, { useState } from 'react'
import { MdFormatOverline } from 'react-icons/md'
import { useLocation, useNavigate } from 'react-router-dom'

const OverrideCard: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const match = location.pathname.includes('/override')
  const [enable, setEnable] = useState(false)

  return (
    <Card
      className={`w-[50%] ml-1 mb-2 ${match ? 'bg-primary' : ''}`}
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
            <MdFormatOverline
              color="default"
              className={`${match ? 'text-white' : 'text-foreground'} text-[24px]`}
            />
          </Button>
          <BorderSwitch
            isShowBorder={match && enable}
            isSelected={enable}
            onValueChange={setEnable}
          />
        </div>
      </CardBody>
      <CardFooter className="pt-1">
        <h3 className={`select-none text-md font-bold ${match ? 'text-white' : 'text-foreground'}`}>
          覆写
        </h3>
      </CardFooter>
    </Card>
  )
}

export default OverrideCard
