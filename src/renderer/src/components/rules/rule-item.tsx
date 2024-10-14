import { Card, CardBody } from '@nextui-org/react'
import React from 'react'

const RuleItem: React.FC<IMihomoRulesDetail & { index: number }> = (props) => {
  const { type, payload, proxy, index } = props
  return (
    <div className={`w-full px-2 pb-2 ${index === 0 ? 'pt-2' : ''}`}>
      <Card>
        <CardBody className="w-full">
          <div title={payload} className="text-ellipsis whitespace-nowrap overflow-hidden">
            {payload}
          </div>
          <div className="flex justify-start text-foreground-500">
            <div>{type}</div>
            <div className="ml-2">{proxy}</div>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

export default RuleItem
