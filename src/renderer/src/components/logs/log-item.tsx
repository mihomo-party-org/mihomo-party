import { Card, CardBody, CardHeader } from '@nextui-org/react'
import React from 'react'

const colorMap = {
  error: 'danger',
  warning: 'warning',
  info: 'primary',
  debug: 'default'
}
const LogItem: React.FC<IMihomoLogInfo> = (props) => {
  const { type, payload, time } = props
  return (
    <Card className="m-2">
      <CardHeader className="pb-0 pt-1 select-none">
        <div className={`mr-2 text-lg font-bold text-${colorMap[type]}`}>
          {props.type.toUpperCase()}
        </div>
        <small className="text-default-500">{time}</small>
      </CardHeader>
      <CardBody className="pt-0 text-sm">{payload}</CardBody>
    </Card>
  )
}

export default LogItem
