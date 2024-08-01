import {
  Button,
  Card,
  CardBody,
  CardFooter,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger
} from '@nextui-org/react'
import { useAppConfig } from '@renderer/hooks/use-config'
import { mihomoVersion, restartCore } from '@renderer/utils/ipc'
import { IoMdRefresh } from 'react-icons/io'
import { useLocation, useNavigate } from 'react-router-dom'
import useSWR from 'swr'

const CoreMap = {
  mihomo: '稳定版',
  'mihomo-alpha': '预览版'
}

const MihomoCoreCard: React.FC = () => {
  const { data: version, mutate } = useSWR('mihomoVersion', mihomoVersion)
  const { appConfig, patchAppConfig } = useAppConfig()
  const { core } = appConfig || {}
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <Card
      fullWidth
      isPressable
      onPress={() => navigate('/mihomo')}
      className={`mb-2 ${location.pathname.includes('/mihomo') ? 'bg-primary' : ''}`}
    >
      <CardBody>
        <div className="flex justify-between h-[32px]">
          <h3 className="select-none text-md font-bold leading-[32px]">
            {version?.version ?? '-'}
          </h3>
          <Button
            isIconOnly
            size="sm"
            variant="light"
            color="default"
            onPress={() => {
              restartCore()
            }}
          >
            <IoMdRefresh color="default" className="text-[24px]" />
          </Button>
        </div>
      </CardBody>
      <CardFooter className="pt-1">
        <Dropdown>
          <DropdownTrigger>
            <Button fullWidth size="sm" variant="solid">
              {core ? CoreMap[core] : ''}
            </Button>
          </DropdownTrigger>
          <DropdownMenu
            onAction={async (key) => {
              await patchAppConfig({ core: key as 'mihomo' | 'mihomo-alpha' })
              await restartCore()
              mutate()
              setTimeout(() => {
                mutate()
              }, 200)
            }}
          >
            <DropdownItem key="mihomo">{CoreMap['mihomo']}</DropdownItem>
            <DropdownItem key="mihomo-alpha">{CoreMap['mihomo-alpha']}</DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </CardFooter>
    </Card>
  )
}

export default MihomoCoreCard
