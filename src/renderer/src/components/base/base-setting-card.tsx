import React from 'react'
import { Card, CardBody } from '@nextui-org/react'

interface Props {
  children?: React.ReactNode
}

const SettingCard: React.FC<Props> = (props) => {
  return (
    <Card className="m-2">
      <CardBody>{props.children}</CardBody>
    </Card>
  )
}

export default SettingCard
