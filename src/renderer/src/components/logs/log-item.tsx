import { Card, CardBody, CardHeader } from '@nextui-org/react'
import React from 'react'

const colorMap = {
  error: 'danger',
  warning: 'warning',
  info: 'primary',
  debug: 'default'
}
const LogItem: React.FC<IMihomoLogInfo & { index: number }> = (props) => {
  const { type, payload, time, index } = props
  return (
    <div className={`px-2 pb-2 ${index === 0 ? 'pt-2' : ''}`}>
      <Card>
        <CardHeader className="pb-0 pt-1">
          <div className={`mr-2 text-lg font-bold text-${colorMap[type]}`}>
            {props.type.toUpperCase()}
          </div>
          <small className="text-foreground-500">{time}</small>
        </CardHeader>
        <CardBody className="select-text pt-0 text-sm">{payload}</CardBody>
      </Card>
    </div>
  )
}

export default LogItem
