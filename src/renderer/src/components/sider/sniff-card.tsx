import { Button, Card, CardBody, CardFooter } from '@nextui-org/react'
import BorderSwitch from '@renderer/components/base/border-swtich'
import { RiScan2Fill } from 'react-icons/ri'
import { useLocation, useNavigate } from 'react-router-dom'
import { patchMihomoConfig } from '@renderer/utils/ipc'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const SniffCard: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const match = location.pathname.includes('/sniffer')
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig(true)
  const { sniffer } = controledMihomoConfig || {}
  const { enable } = sniffer || {}
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: 'sniff'
  })

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
      className="col-span-1"
    >
      <Card
        fullWidth
        className={`col-span-1 ${match ? 'bg-primary' : ''}`}
        isPressable
        onPress={() => navigate('/sniffer')}
      >
        <CardBody className="pb-1 pt-0 px-0">
          <div ref={setNodeRef} {...attributes} {...listeners} className="flex justify-between">
            <Button
              isIconOnly
              className="bg-transparent pointer-events-none"
              variant="flat"
              color="default"
            >
              <RiScan2Fill
                color="default"
                className={`${match ? 'text-white' : 'text-foreground'} text-[24px]`}
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
          <h3 className={`text-md font-bold ${match ? 'text-white' : 'text-foreground'}`}>
            域名嗅探
          </h3>
        </CardFooter>
      </Card>
    </div>
  )
}

export default SniffCard
