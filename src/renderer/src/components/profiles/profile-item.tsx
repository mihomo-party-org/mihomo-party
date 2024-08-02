import { Button, Card, CardBody, CardFooter, Progress } from '@nextui-org/react'
import { calcPercent, calcTraffic } from '@renderer/utils/calc'
import React from 'react'
import { IoMdRefresh } from 'react-icons/io'

interface Props {
  info: IProfileItem
  isCurrent: boolean
  onClick: () => Promise<void>
}

const ProfileItem: React.FC<Props> = (props) => {
  const { info, onClick, isCurrent } = props
  const extra = info?.extra
  const usage = (extra?.upload ?? 0) + (extra?.download ?? 0)
  const total = extra?.total ?? 0

  return (
    <Card fullWidth isPressable onPress={onClick} className={isCurrent ? 'bg-primary' : ''}>
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

export default ProfileItem
