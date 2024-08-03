import { Card, CardBody, Divider } from '@nextui-org/react'
import React from 'react'

interface Props {
  proxy: IMihomoProxy | IMihomoGroup
  onSelect: (proxy: string) => void
  selected: boolean
}

const ProxyItem: React.FC<Props> = (props) => {
  const { proxy, selected, onSelect } = props
  return (
    <>
      <Divider />
      <Card
        onPress={() => onSelect(proxy.name)}
        isPressable
        fullWidth
        className={`my-1 ${selected ? 'bg-primary' : ''}`}
        radius="sm"
      >
        <CardBody className="p-1">
          <div className="flex justify-between items-center">
            <div>{proxy.name}</div>
            <div className="mx-2 text-sm">{proxy.history.length > 0 && proxy.history[0].delay}</div>
          </div>
        </CardBody>
      </Card>
    </>
  )
}

export default ProxyItem
