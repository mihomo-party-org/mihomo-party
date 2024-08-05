import { Button, Card, CardBody, CardFooter } from '@nextui-org/react'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import BorderSwitch from '@renderer/components/base/border-swtich'
import { TbDeviceIpadHorizontalBolt } from 'react-icons/tb'
import { useLocation, useNavigate } from 'react-router-dom'
import { encryptString, patchMihomoConfig, isEncryptionAvailable } from '@renderer/utils/ipc'
import { platform } from '@renderer/utils/init'
import React, { useState } from 'react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import BasePasswordModal from '../base/base-password-modal'

const TunSwitcher: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const match = location.pathname.includes('/tun')
  const [openPasswordModal, setOpenPasswordModal] = useState(false)
  const { appConfig, patchAppConfig } = useAppConfig()
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig(true)
  const { tun } = controledMihomoConfig || {}
  const { enable } = tun || {}

  const onChange = async (enable: boolean): Promise<void> => {
    if (enable && platform !== 'win32') {
      const encryptionAvailable = await isEncryptionAvailable()
      if (!appConfig?.encryptedPassword && encryptionAvailable) {
        setOpenPasswordModal(true)
        return
      }
      if (!encryptionAvailable) {
        alert('加密不可用，请手动给内核授权')
      }
    }

    await patchControledMihomoConfig({ tun: { enable } })
    await patchMihomoConfig({ tun: { enable } })
  }

  return (
    <>
      {openPasswordModal && (
        <BasePasswordModal
          onCancel={() => setOpenPasswordModal(false)}
          onConfirm={async (password: string) => {
            const encrypted = await encryptString(password)
            patchAppConfig({ encryptedPassword: encrypted })
            setOpenPasswordModal(false)
          }}
        />
      )}
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
              <TbDeviceIpadHorizontalBolt
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
          <h3
            className={`select-none text-md font-bold ${match ? 'text-white' : 'text-foreground'}`}
          >
            虚拟网卡
          </h3>
        </CardFooter>
      </Card>
    </>
  )
}

export default TunSwitcher
