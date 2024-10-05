import { Button, Card, CardBody, CardFooter } from '@nextui-org/react'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import BorderSwitch from '@renderer/components/base/border-swtich'
import { TbDeviceIpadHorizontalBolt } from 'react-icons/tb'
import { useLocation } from 'react-router-dom'
import { encryptString, isEncryptionAvailable, restartCore } from '@renderer/utils/ipc'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { platform } from '@renderer/utils/init'
import React, { useState } from 'react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import BasePasswordModal from '../base/base-password-modal'

const TunSwitcher: React.FC = () => {
  const location = useLocation()
  const match = location.pathname.includes('/tun') || false
  const [openPasswordModal, setOpenPasswordModal] = useState(false)
  const { appConfig, patchAppConfig } = useAppConfig()
  const { tunCardStatus = 'col-span-1' } = appConfig || {}
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()
  const { tun } = controledMihomoConfig || {}
  const { enable } = tun || {}
  const {
    attributes,
    listeners,
    setNodeRef,
    transform: tf,
    transition,
    isDragging
  } = useSortable({
    id: 'tun'
  })
  const transform = tf ? { x: tf.x, y: tf.y, scaleX: 1, scaleY: 1 } : null
  const onChange = async (enable: boolean): Promise<void> => {
    if (enable && platform !== 'win32') {
      const encryptionAvailable = await isEncryptionAvailable()
      if (!appConfig?.encryptedPassword && encryptionAvailable) {
        setOpenPasswordModal(true)
        return
      }
      if (!appConfig?.encryptedPassword && !encryptionAvailable) {
        alert('加密不可用，请手动给内核授权')
        await patchAppConfig({ encryptedPassword: [] })
        return
      }
    }

    if (enable) {
      await patchControledMihomoConfig({ tun: { enable }, dns: { enable: true } })
    } else {
      await patchControledMihomoConfig({ tun: { enable } })
    }
    await restartCore()
    window.electron.ipcRenderer.send('updateFloatingWindow')
    window.electron.ipcRenderer.send('updateTrayMenu')
  }

  return (
    <div
      style={{
        position: 'relative',
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 'calc(infinity)' : undefined
      }}
      className={`${tunCardStatus} tun-card`}
    >
      {openPasswordModal && (
        <BasePasswordModal
          onCancel={() => setOpenPasswordModal(false)}
          onConfirm={async (password: string) => {
            try {
              const encrypted = await encryptString(password)
              await patchAppConfig({ encryptedPassword: encrypted })
              await patchControledMihomoConfig({ tun: { enable: true }, dns: { enable: true } })
              await restartCore()
              window.electron.ipcRenderer.send('updateTrayMenu')
              setOpenPasswordModal(false)
            } catch (e) {
              alert(e)
            }
          }}
        />
      )}

      <Card
        fullWidth
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        className={`${match ? 'bg-primary' : 'hover:bg-primary/30'} ${isDragging ? 'scale-[0.97] tap-highlight-transparent' : ''}`}
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
                className={`${match ? 'text-primary-foreground' : 'text-foreground'} text-[24px] font-bold`}
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
            className={`text-md font-bold ${match ? 'text-primary-foreground' : 'text-foreground'}`}
          >
            虚拟网卡
          </h3>
        </CardFooter>
      </Card>
    </div>
  )
}

export default TunSwitcher
