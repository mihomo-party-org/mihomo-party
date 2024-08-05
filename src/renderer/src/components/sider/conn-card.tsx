import { Button, Card, CardBody, CardFooter } from '@nextui-org/react'
import { FaCircleArrowDown, FaCircleArrowUp } from 'react-icons/fa6'
import { useLocation, useNavigate } from 'react-router-dom'
import { calcTraffic } from '@renderer/utils/calc'
import { useEffect, useState } from 'react'
import { IoLink } from 'react-icons/io5'

const ConnCard: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const match = location.pathname.includes('/connections')

  const [upload, setUpload] = useState(0)
  const [download, setDownload] = useState(0)

  useEffect(() => {
    window.electron.ipcRenderer.on('mihomoTraffic', (_e, info: IMihomoTrafficInfo) => {
      setUpload(info.up)
      setDownload(info.down)
    })
    return (): void => {
      window.electron.ipcRenderer.removeAllListeners('mihomoTraffic')
    }
  }, [])

  return (
    <Card
      fullWidth
      className={`mb-2 ${match ? 'bg-primary' : ''}`}
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
            <IoLink
              color="default"
              className={`${match ? 'text-white' : 'text-foreground'} text-[24px]`}
            />
          </Button>
          <div className={`p-2 w-full select-none ${match ? 'text-white' : 'text-foreground'} `}>
            <div className="flex justify-between">
              <div className="w-full text-right mr-2">{calcTraffic(upload)}/s</div>
              <FaCircleArrowUp className="h-[24px] leading-[24px]" />
            </div>
            <div className="flex justify-between">
              <div className="w-full text-right mr-2">{calcTraffic(download)}/s</div>
              <FaCircleArrowDown className="h-[24px] leading-[24px]" />
            </div>
          </div>
        </div>
      </CardBody>
      <CardFooter className="pt-1">
        <h3 className={`select-none text-md font-bold ${match ? 'text-white' : 'text-foreground'}`}>
          连接
        </h3>
      </CardFooter>
    </Card>
  )
}

export default ConnCard
