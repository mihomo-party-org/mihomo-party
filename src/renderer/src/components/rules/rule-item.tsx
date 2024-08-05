import { Card, CardBody } from '@nextui-org/react'
import React from 'react'

const RuleItem: React.FC<IMihomoRulesDetail> = (props) => {
  const { type, payload, proxy } = props
  return (
    <Card className="mb-2 mx-2">
      <CardBody className="flex justify-between">
        <div className="flex justify-between">
          <div className="select-none">{type}</div>
          <div className="select-none">{payload}</div>
          <div className="select-none">{proxy}</div>
        </div>
      </CardBody>
    </Card>
  )
}

export default RuleItem
