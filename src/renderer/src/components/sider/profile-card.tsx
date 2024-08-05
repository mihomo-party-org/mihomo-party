import { Button, Card, CardBody, CardFooter, Progress } from '@nextui-org/react'
import { useProfileConfig } from '@renderer/hooks/use-profile-config'
import { useLocation, useNavigate } from 'react-router-dom'
import { calcTraffic, calcPercent } from '@renderer/utils/calc'
import { IoMdRefresh } from 'react-icons/io'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'
import dayjs from 'dayjs'
import { useState } from 'react'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

const ProfileCard: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const match = location.pathname.includes('/profiles')
  const [updating, setUpdating] = useState(false)
  const { profileConfig, addProfileItem } = useProfileConfig()
  const { current, items } = profileConfig ?? {}
  const info = items?.find((item) => item.id === current) ?? {
    id: 'default',
    type: 'local',
    name: '空白订阅'
  }

  const extra = info?.extra
  const usage = (extra?.upload ?? 0) + (extra?.download ?? 0)
  const total = extra?.total ?? 0

  return (
    <Card
      fullWidth
      className={`mb-2 ${match ? 'bg-primary' : ''}`}
      isPressable
      onPress={() => navigate('/profiles')}
    >
      <CardBody className="pb-1">
        <div className="flex justify-between h-[32px]">
          <h3
            className={`select-none text-ellipsis whitespace-nowrap overflow-hidden text-md font-bold leading-[32px] ${match ? 'text-white' : 'text-foreground'} `}
          >
            {info?.name}
          </h3>
          <Button
            isIconOnly
            size="sm"
            disabled={updating}
            variant="light"
            color="default"
            onPress={() => {
              setUpdating(true)
              addProfileItem(info).finally(() => {
                setUpdating(false)
              })
            }}
          >
            <IoMdRefresh
              className={`text-[24px] ${match ? 'text-white' : 'text-foreground'} ${updating ? 'animate-spin' : ''}`}
            />
          </Button>
        </div>
        <div className={`mt-2 flex justify-between ${match ? 'text-white' : 'text-foreground'} `}>
          <small>{extra ? `${calcTraffic(usage)}/${calcTraffic(total)}` : undefined}</small>
          <small>{dayjs(info.updated).fromNow()}</small>
        </div>
      </CardBody>
      <CardFooter className="pt-0">
        {extra && (
          <Progress
            className="w-full"
            classNames={{ indicator: match ? 'bg-white' : 'bg-foreground', label: 'select-none' }}
            value={calcPercent(extra?.upload, extra?.download, extra?.total)}
          />
        )}
      </CardFooter>
    </Card>
  )
}

export default ProfileCard
