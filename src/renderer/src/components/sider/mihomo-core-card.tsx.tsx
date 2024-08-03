import { Button, Card, CardBody, CardFooter } from '@nextui-org/react'
import { calcTraffic } from '@renderer/utils/calc'
import { mihomoVersion, restartCore } from '@renderer/utils/ipc'
import { useEffect, useState } from 'react'
import { IoMdRefresh } from 'react-icons/io'
import { useLocation, useNavigate } from 'react-router-dom'
import useSWR from 'swr'

const MihomoCoreCard: React.FC = () => {
  const { data: version, mutate } = useSWR('mihomoVersion', mihomoVersion)
  const navigate = useNavigate()
  const location = useLocation()
  const match = location.pathname.includes('/mihomo')

  const [mem, setMem] = useState(0)

  useEffect(() => {
    const token = PubSub.subscribe('mihomo-core-changed', () => {
      mutate()
      setTimeout(() => {
        mutate()
      }, 1000)
    })
    window.electron.ipcRenderer.on('mihomoMemory', (_e, info: IMihomoMemoryInfo) => {
      setMem(info.inuse)
    })
    return (): void => {
      PubSub.unsubscribe(token)
      window.electron.ipcRenderer.removeAllListeners('mihomoMemory')
    }
  }, [])

  return (
    <Card
      fullWidth
      isPressable
      onPress={() => navigate('/mihomo')}
      className={`mb-2 ${match ? 'bg-primary' : ''}`}
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
        <div className="flex justify-between w-full">
          <h4 className="select-none text-md font-bold">内核设置</h4>
          <h4 className="select-none text-md">{calcTraffic(mem)}</h4>
        </div>
      </CardFooter>
    </Card>
  )
}

export default MihomoCoreCard
