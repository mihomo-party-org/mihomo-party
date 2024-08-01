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
import useSWR from 'swr'

const CoreMap = {
  mihomo: 'Mihomo',
  'mihomo-alpha': 'Mihomo Alpha'
}

const MihomoCoreCard: React.FC = () => {
  const { data: version, mutate } = useSWR('mihomoVersion', mihomoVersion)
  const { appConfig, patchAppConfig } = useAppConfig()
  const { core } = appConfig || {}

  return (
    <Card
      fullWidth
      className={`mb-2 ${location.pathname.includes('/profiles') ? 'bg-primary' : ''}`}
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
            <Button variant="faded" fullWidth>
              {core ? CoreMap[core] : ''}
            </Button>
          </DropdownTrigger>
          <DropdownMenu
            onAction={async (key) => {
              await patchAppConfig({ core: key as 'mihomo' | 'mihomo-alpha' })
              await restartCore()
              await mutate()
            }}
          >
            <DropdownItem key="mihomo">Mihomo </DropdownItem>
            <DropdownItem key="mihomo-alpha">Mihomo Alpha</DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </CardFooter>
    </Card>
  )
}

export default MihomoCoreCard
