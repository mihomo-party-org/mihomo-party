import { Button, Card, CardBody, CardFooter, Progress } from '@nextui-org/react'
import { getCurrentProfileItem } from '@renderer/utils/ipc'
import { IoMdRefresh } from 'react-icons/io'
import { useLocation, useNavigate } from 'react-router-dom'
import useSWR from 'swr'
const ProfileCard: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const match = location.pathname.includes('/profiles')

  const { data: info } = useSWR('getCurrentProfileItem', getCurrentProfileItem)
  const extra = info?.extra

  return (
    <Card
      fullWidth
      className={`mb-2 ${match ? 'bg-primary' : ''}`}
      isPressable
      onPress={() => navigate('/profiles')}
    >
      <CardBody>
        <div className="flex justify-between h-[32px]">
          <h3 className="select-none text-md font-bold leading-[32px]">{info?.name}</h3>
          <Button isIconOnly size="sm" variant="light" color="default">
            <IoMdRefresh color="default" className="text-[24px]" />
          </Button>
        </div>
      </CardBody>
      <CardFooter className="pt-1">
        <Progress
          classNames={{ indicator: 'bg-foreground' }}
          value={calcPercent(extra?.upload, extra?.download, extra?.total)}
          className="max-w-md"
        />
      </CardFooter>
    </Card>
  )
}

export default ProfileCard

function calcPercent(
  upload: number | undefined,
  download: number | undefined,
  total: number | undefined
): number {
  if (upload === undefined || download === undefined || total === undefined) {
    return 100
  }
  return Math.round(((upload + download) / total) * 100)
}
