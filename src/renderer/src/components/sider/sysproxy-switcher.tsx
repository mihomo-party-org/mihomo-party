import { Button, Card, CardBody, CardFooter } from '@nextui-org/react'
import BorderSwitch from '@renderer/components/base/border-swtich'
import { useLocation } from 'react-router-dom'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { triggerSysProxy } from '@renderer/utils/ipc'
import { AiOutlineGlobal } from 'react-icons/ai'
import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const SysproxySwitcher: React.FC = () => {
  const location = useLocation()
  const match = location.pathname.includes('/sysproxy')
  const { appConfig, patchAppConfig } = useAppConfig()
  const { sysProxy, sysproxyCardStatus = 'col-span-1' } = appConfig || {}
  const { enable } = sysProxy || {}
  const {
    attributes,
    listeners,
    setNodeRef,
    transform: tf,
    transition,
    isDragging
  } = useSortable({
    id: 'sysproxy'
  })
  const transform = tf ? { x: tf.x, y: tf.y, scaleX: 1, scaleY: 1 } : null
  const onChange = async (enable: boolean): Promise<void> => {
    try {
      await triggerSysProxy(enable)
      await patchAppConfig({ sysProxy: { enable } })
      window.electron.ipcRenderer.send('updateFloatingWindow')
      window.electron.ipcRenderer.send('updateTrayMenu')
    } catch (e) {
      alert(e)
    }
  }

  return (
    <div
      style={{
        position: 'relative',
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 'calc(infinity)' : undefined
      }}
      className={`${sysproxyCardStatus} sysproxy-card`}
    >
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
              <AiOutlineGlobal
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
            系统代理
          </h3>
        </CardFooter>
      </Card>
    </div>
  )
}

export default SysproxySwitcher
