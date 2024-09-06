import { Button, Card, CardBody, CardFooter } from '@nextui-org/react'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import BorderSwitch from '@renderer/components/base/border-swtich'
import { LuServer } from 'react-icons/lu'
import { useLocation } from 'react-router-dom'
import { patchMihomoConfig } from '@renderer/utils/ipc'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useAppConfig } from '@renderer/hooks/use-app-config'
const DNSCard: React.FC = () => {
  const { appConfig } = useAppConfig()
  const { dnsCardStatus = 'col-span-1', controlDns = true } = appConfig || {}
  const location = useLocation()
  const match = location.pathname.includes('/dns')
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()
  const { dns, tun } = controledMihomoConfig || {}
  const { enable = true } = dns || {}
  const {
    attributes,
    listeners,
    setNodeRef,
    transform: tf,
    transition,
    isDragging
  } = useSortable({
    id: 'dns'
  })
  const transform = tf ? { x: tf.x, y: tf.y, scaleX: 1, scaleY: 1 } : null
  const onChange = async (enable: boolean): Promise<void> => {
    await patchControledMihomoConfig({ dns: { enable } })
    await patchMihomoConfig({ dns: { enable } })
  }

  return (
    <div
      ref={setNodeRef} {...attributes} {...listeners}
      style={{
        position: 'relative',
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 'calc(infinity)' : undefined
      }}
      className={`${dnsCardStatus} ${!controlDns ? 'hidden' : ''}`}
    >
      <Card
        fullWidth
        className={`${match ? 'bg-primary' : ''} ${isDragging ? 'scale-[0.97] tap-highlight-transparent' : ''}`}
      >
        <CardBody className="pb-1 pt-0 px-0">
          <div className="flex justify-between">
            <Button
              isIconOnly
              className="bg-transparent pointer-events-none"
              variant="flat"
              color="default"
            >
              <LuServer
                className={`${match ? 'text-white' : 'text-foreground'} text-[24px] font-bold`}
              />
            </Button>
            <BorderSwitch
              isShowBorder={match && enable}
              isSelected={enable}
              isDisabled={tun?.enable}
              onValueChange={onChange}
            />
          </div>
        </CardBody>
        <CardFooter className="pt-1">
          <h3 className={`text-md font-bold ${match ? 'text-white' : 'text-foreground'}`}>DNS</h3>
        </CardFooter>
      </Card>
    </div>
  )
}

export default DNSCard
