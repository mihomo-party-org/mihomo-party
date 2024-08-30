import { Button, Card, CardFooter, CardHeader, Chip } from '@nextui-org/react'
import { calcTraffic } from '@renderer/utils/calc'
import dayjs from 'dayjs'
import React, { useState } from 'react'
import { CgClose } from 'react-icons/cg'
import ConnectionDetailModal from './connection-detail-modal'

interface Props {
  index: number
  info: IMihomoConnectionDetail
  close: (id: string) => Promise<void>
}

const ConnectionItem: React.FC<Props> = (props) => {
  const { index, info } = props
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  return (
    <div className={`px-2 pb-2 ${index === 0 ? 'pt-2' : ''}`}>
      {isDetailModalOpen && (
        <ConnectionDetailModal onClose={() => setIsDetailModalOpen(false)} connection={info} />
      )}
      <Card
        isPressable
        className="w-full"
        onPress={() => {
          setIsDetailModalOpen(true)
        }}
      >
        <div className="w-full flex justify-between">
          <div className="w-[calc(100%-48px)]">
            <CardHeader className="pb-0 gap-1">
              <Chip color="primary" size="sm" radius="sm" variant="light">
                {info.metadata.type}({info.metadata.network.toUpperCase()})
              </Chip>
              <div className="text-ellipsis whitespace-nowrap overflow-hidden">
                {info.metadata.process || info.metadata.sourceIP}
                {' -> '}
                {info.metadata.host ||
                  info.metadata.sniffHost ||
                  info.metadata.remoteDestination ||
                  info.metadata.destinationIP}
              </div>
              <small className="whitespace-nowrap text-default-500">
                {dayjs(info.start).fromNow()}
              </small>
            </CardHeader>
            <CardFooter
              onWheel={(e) => {
                e.currentTarget.scrollLeft += e.deltaY
              }}
              className="overscroll-contain pt-1 flex justify-start gap-1 overflow-x-auto no-scrollbar"
            >
              <Chip
                className="flag-emoji text-ellipsis whitespace-nowrap overflow-hidden"
                size="sm"
                radius="sm"
                variant="bordered"
              >
                {info.chains[0]}
              </Chip>
              <Chip size="sm" radius="sm" variant="bordered">
                ↑ {calcTraffic(info.upload)} ↓ {calcTraffic(info.download)}
              </Chip>
              {info.uploadSpeed !== 0 || info.downloadSpeed !== 0 ? (
                <Chip color="primary" size="sm" radius="sm" variant="bordered">
                  ↑ {calcTraffic(info.uploadSpeed || 0)}/s ↓ {calcTraffic(info.downloadSpeed || 0)}
                  /s
                </Chip>
              ) : null}
            </CardFooter>
          </div>
          <Button
            color="warning"
            variant="light"
            isIconOnly
            className="mr-2 my-auto"
            onPress={() => {
              props.close(info.id)
            }}
          >
            <CgClose className="text-lg" />
          </Button>
        </div>
      </Card>
    </div>
  )
}

export default ConnectionItem
