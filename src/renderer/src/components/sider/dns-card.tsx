import { Button, Card, CardBody, CardFooter } from '@nextui-org/react'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import BorderSwitch from '@renderer/components/base/border-swtich'
import { MdOutlineDns } from "react-icons/md"
import { useLocation, useNavigate } from 'react-router-dom'
import { patchMihomoConfig } from '@renderer/utils/ipc'

const DNSCard: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const match = location.pathname.includes('/dns')
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig(true)
  const { dns, tun } = controledMihomoConfig || {}
  const { enable } = dns || {}

  const onChange = async (enable: boolean): Promise<void> => {
    await patchControledMihomoConfig({ dns: { enable } })
    await patchMihomoConfig({ dns: { enable } })
  }

  return (
    <Card
      className={`w-[50%] ml-1 mb-2 ${match ? 'bg-primary' : ''}`}
      isPressable
      onPress={() => navigate('/dns')}
    >
      <CardBody className="pb-1 pt-0 px-0">
        <div className="flex justify-between">
          <Button
            isIconOnly
            className="bg-transparent pointer-events-none"
            variant="flat"
            color="default"
          >
            <MdOutlineDns
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
        <h3
          className={`select-none text-md font-bold ${match ? 'text-white' : 'text-foreground'}`}
        >
          DNS
        </h3>
      </CardFooter>
    </Card>
  )
}

export default DNSCard
