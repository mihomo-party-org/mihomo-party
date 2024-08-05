import { Button, Card, CardBody, CardFooter } from '@nextui-org/react'
import BorderSwitch from '@renderer/components/base/border-swtich'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { triggerSysProxy } from '@renderer/utils/ipc'
import { AiOutlineGlobal } from 'react-icons/ai'
import React from 'react'

const SysproxySwitcher: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const match = location.pathname.includes('/sysproxy')
  const { appConfig, patchAppConfig } = useAppConfig(true)
  const { sysProxy } = appConfig || {}
  const { enable } = sysProxy || {}

  const onChange = async (enable: boolean): Promise<void> => {
    try {
      await triggerSysProxy(enable)
      await patchAppConfig({ sysProxy: { enable } })
    } catch (e) {
      console.log(e)
    }
  }

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
            <AiOutlineGlobal
              className={`${match ? 'text-white' : 'text-foreground'} text-[24px] font-bold`}
            />
          </Button>
          <BorderSwitch
            isShowBorder={match && enable}
            isSelected={enable}
            onValueChange={onChange}
          />
        </div>
      </CardBody>
      <CardFooter className="pt-1">
        <h3 className={`select-none text-md font-bold ${match ? 'text-white' : 'text-foreground'}`}>
          系统代理
        </h3>
      </CardFooter>
    </Card>
  )
}

export default SysproxySwitcher
