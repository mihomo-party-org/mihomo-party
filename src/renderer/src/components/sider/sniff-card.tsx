import { Button, Card, CardBody, CardFooter } from '@nextui-org/react'
import BorderSwitch from '@renderer/components/base/border-swtich'
import { GrDomain } from "react-icons/gr"
import { useLocation, useNavigate } from 'react-router-dom'
import { patchMihomoConfig } from '@renderer/utils/ipc'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'

const SniffCard: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const match = location.pathname.includes('/sniffer')
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig(true)
  const { sniffer } = controledMihomoConfig || {}
  const { enable } = sniffer || {}

  const onChange = async (enable: boolean): Promise<void> => {
    await patchControledMihomoConfig({ sniffer: { enable } })
    await patchMihomoConfig({ sniffer: { enable } })
  }

  return (
    <Card
      className={`w-[50%] ml-1 mb-2 ${match ? 'bg-primary' : ''}`}
      isPressable
      onPress={() => navigate('/sniffer')}
    >
      <CardBody className="pb-1 pt-0 px-0">
        <div className="flex justify-between">
          <Button
            isIconOnly
            className="bg-transparent pointer-events-none"
            variant="flat"
            color="default"
          >
            <GrDomain
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
        <h3 className={`select-none text-md font-bold ${match ? 'text-white' : 'text-foreground'}`}>
          域名嗅探
        </h3>
      </CardFooter>
    </Card>
  )
}

export default SniffCard
