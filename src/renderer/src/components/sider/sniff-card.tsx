import { Button, Card, CardBody, CardFooter } from '@nextui-org/react'
import BorderSwitch from '@renderer/components/base/border-swtich'
import { RiScan2Fill } from 'react-icons/ri'
import { useLocation } from 'react-router-dom'
import { patchMihomoConfig } from '@renderer/utils/ipc'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useAppConfig } from '@renderer/hooks/use-app-config'

const SniffCard: React.FC = () => {
  const { appConfig } = useAppConfig()
  const { sniffCardStatus = 'col-span-1', controlSniff = true } = appConfig || {}
  const location = useLocation()
  const match = location.pathname.includes('/sniffer')
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()
  const { sniffer } = controledMihomoConfig || {}
  const { enable } = sniffer || {}
  const {
    attributes,
    listeners,
    setNodeRef,
    transform: tf,
    transition,
    isDragging
  } = useSortable({
    id: 'sniff'
  })
  const transform = tf ? { x: tf.x, y: tf.y, scaleX: 1, scaleY: 1 } : null
  const onChange = async (enable: boolean): Promise<void> => {
    await patchControledMihomoConfig({ sniffer: { enable } })
    await patchMihomoConfig({ sniffer: { enable } })
  }

  return (
    <div
      style={{
        position: 'relative',
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 'calc(infinity)' : undefined
      }}
      className={`${sniffCardStatus} ${!controlSniff ? 'hidden' : ''} sniff-card`}
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
              <RiScan2Fill
                color="default"
                className={`${match ? 'text-primary-foreground' : 'text-foreground'} text-[24px]`}
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
            域名嗅探
          </h3>
        </CardFooter>
      </Card>
    </div>
  )
}

export default SniffCard
