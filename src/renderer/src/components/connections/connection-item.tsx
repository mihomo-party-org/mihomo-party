import { Button, Card, CardBody } from '@nextui-org/react'
import { mihomoCloseConnection } from '@renderer/utils/ipc'
import { IoClose } from 'react-icons/io5'
import React from 'react'

interface Props extends IMihomoConnectionDetail {
  mutate: () => void
}
const ConnectionItem: React.FC<Props> = (props) => {
  const { id, metadata, mutate } = props
  return (
    <Card className="m-2">
      <CardBody className="">
        <div className="flex justify-between">
          <div className="select-none h-[32px] leading-[32px]">
            {metadata.type}({metadata.network})
          </div>
          <div className="select-none h-[32px] leading-[32px]">{metadata.inboundIP}</div>
          <div className="select-none h-[32px] leading-[32px]">{'-->'}</div>
          <div className="select-none h-[32px] leading-[32px]">{metadata.remoteDestination}</div>
          <Button
            isIconOnly
            size="sm"
            color="danger"
            variant="light"
            onPress={() => {
              mihomoCloseConnection(id).then(() => {
                mutate()
              })
            }}
          >
            <IoClose className="text-[24px]" />
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

export default ConnectionItem
