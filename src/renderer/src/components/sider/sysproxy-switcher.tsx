import { Button, Card, CardBody, CardFooter, Switch } from '@nextui-org/react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAppConfig } from '@renderer/hooks/use-config'
import { AiOutlineGlobal } from 'react-icons/ai'
import React from 'react'
import { triggerSysProxy } from '@renderer/utils/ipc'

const SysproxySwitcher: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const match = location.pathname.includes('/sysproxy')
  const { appConfig, patchAppConfig } = useAppConfig()
  const { sysProxy } = appConfig || {}
  const { enable } = sysProxy || {}

  const onChange = async (enable: boolean): Promise<void> => {
    await patchAppConfig({ sysProxy: { enable } })
    await triggerSysProxy(enable)
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
            <AiOutlineGlobal color="default" className="text-[24px]" />
          </Button>
          <Switch
            classNames={{
              wrapper: `${match && enable ? 'border-2' : ''}`
            }}
            size="sm"
            isSelected={enable}
            onValueChange={onChange}
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
