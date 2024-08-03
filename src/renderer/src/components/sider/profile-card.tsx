import { Button, Card, CardBody, CardFooter, Progress } from '@nextui-org/react'
import { useProfileConfig } from '@renderer/hooks/use-profile-config'
import { useLocation, useNavigate } from 'react-router-dom'
import { calcTraffic, calcPercent } from '@renderer/utils/calc'
import { IoMdRefresh } from 'react-icons/io'

const ProfileCard: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const match = location.pathname.includes('/profiles')

  const { profileConfig } = useProfileConfig()
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
      <CardBody>
        <div className="flex justify-between h-[32px]">
          <h3 className="select-none text-ellipsis whitespace-nowrap overflow-hidden text-md font-bold leading-[32px]">
            {info?.name}
          </h3>
          <Button isIconOnly size="sm" variant="light" color="default">
            <IoMdRefresh color="default" className="text-[24px]" />
          </Button>
        </div>
      </CardBody>
      <CardFooter className="pt-1">
        <Progress
          classNames={{ indicator: 'bg-foreground', label: 'select-none' }}
          label={extra ? `${calcTraffic(usage)}/${calcTraffic(total)}` : undefined}
          value={calcPercent(extra?.upload, extra?.download, extra?.total)}
          className="max-w-md"
        />
      </CardFooter>
    </Card>
  )
}

export default ProfileCard
