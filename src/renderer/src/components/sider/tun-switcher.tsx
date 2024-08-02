import { Button, Card, CardBody, CardFooter } from '@nextui-org/react'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import BorderSwitch from '@renderer/components/base/border-swtich'
import { TbDeviceIpadHorizontalBolt } from 'react-icons/tb'
import { useLocation, useNavigate } from 'react-router-dom'
import { patchMihomoConfig } from '@renderer/utils/ipc'
import React from 'react'

const TunSwitcher: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const match = location.pathname.includes('/tun')

  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()
  const { tun } = controledMihomoConfig || {}
  const { enable } = tun || {}

  console.log('controledMihomoConfig', controledMihomoConfig)
  const onChange = async (enable: boolean): Promise<void> => {
    await patchControledMihomoConfig({ tun: { enable } })
    await patchMihomoConfig({ tun: { enable } })
  }

  return (
    <Card
      className={`w-[50%] ml-1 ${match ? 'bg-primary' : ''}`}
      isPressable
      onPress={() => navigate('/tun')}
    >
      <CardBody className="pb-1 pt-0 px-0">
        <div className="flex justify-between">
          <Button
            isIconOnly
            className="bg-transparent pointer-events-none"
            variant="flat"
            color="default"
          >
            <TbDeviceIpadHorizontalBolt color="default" className="text-[24px] font-bold" />
          </Button>
          <BorderSwitch
            isShowBorder={match && enable}
            isSelected={enable}
            onValueChange={onChange}
          />
        </div>
      </CardBody>
      <CardFooter className="pt-1">
        <h3 className="select-none text-md font-bold">虚拟网卡</h3>
      </CardFooter>
    </Card>
  )
}

export default TunSwitcher
