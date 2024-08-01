import { Button, Card, CardBody, CardFooter, Chip } from '@nextui-org/react'
import { useLocation, useNavigate } from 'react-router-dom'
import { IoLink } from 'react-icons/io5'
import { useEffect } from 'react'
import useSWR from 'swr'
import { mihomoConnections } from '@renderer/utils/ipc'

const ConnCard: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const { data: connections } = useSWR<IMihomoConnectionsInfo>('/connections', mihomoConnections, {
    refreshInterval: 5000
  })

  useEffect(() => {
    window.electron.ipcRenderer.on('mihomoTraffic', (_e, info: IMihomoTrafficInfo) => {
      console.log(info)
    })
    return (): void => {
      window.electron.ipcRenderer.removeAllListeners('mihomoTraffic')
    }
  }, [])

  return (
    <Card
      className={`w-[50%] mr-1 mb-2 ${location.pathname.includes('/connections') ? 'bg-primary' : ''}`}
      isPressable
      onPress={() => navigate('/connections')}
    >
      <CardBody className="pb-1 pt-0 px-0">
        <div className="flex justify-between">
          <Button
            isIconOnly
            className="bg-transparent pointer-events-none"
            variant="flat"
            color="default"
          >
            <IoLink color="default" className="text-[20px]" />
          </Button>
          <Chip size="sm" color="secondary" variant="bordered" className="mr-3 mt-2">
            {connections?.connections?.length ?? 0}
          </Chip>
        </div>
      </CardBody>
      <CardFooter className="pt-1">
        <h3 className="select-none text-md font-bold">连接</h3>
      </CardFooter>
    </Card>
  )
}

export default ConnCard
