import ConnectionItem from '@renderer/components/connections/connection-item'
import BasePage from '@renderer/components/base/base-page'
import { mihomoCloseAllConnections, mihomoConnections } from '@renderer/utils/ipc'
import { useMemo, useState } from 'react'
import { Button, Input } from '@nextui-org/react'
import useSWR from 'swr'
import { calcTraffic } from '@renderer/utils/calc'

const Connections: React.FC = () => {
  const { data: connections = { downloadTotal: 0, uploadTotal: 0, connections: [] }, mutate } =
    useSWR<IMihomoConnectionsInfo>('mihomoConnections', mihomoConnections, {
      refreshInterval: 1000
    })
  const [filter, setFilter] = useState('')

  const filteredConnections = useMemo(() => {
    if (filter === '') return connections.connections
    return connections.connections?.filter((connection) => {
      return connection.metadata.remoteDestination.includes(filter)
    })
  }, [connections, filter])

  return (
    <BasePage
      title="连接"
      header={
        <div className="flex">
          <div className="flex items-center">
            <span className="mx-1 text-gray-400">
              下载: {calcTraffic(connections.downloadTotal)}{' '}
            </span>
            <span className="mx-1 text-gray-400">
              上传: {calcTraffic(connections.uploadTotal)}{' '}
            </span>
          </div>
          <Button
            className="ml-1"
            size="sm"
            color="primary"
            onPress={() =>
              mihomoCloseAllConnections().then(() => {
                mutate()
              })
            }
          >
            关闭所有连接
          </Button>
        </div>
      }
    >
      <div className="sticky top-[48px] z-40 backdrop-blur bg-background/40 flex p-2">
        <Input
          variant="bordered"
          size="sm"
          value={filter}
          placeholder="筛选过滤"
          onValueChange={setFilter}
        />
      </div>
      {filteredConnections?.map((connection) => {
        return (
          <ConnectionItem
            mutate={mutate}
            key={connection.id}
            id={connection.id}
            chains={connection.chains}
            download={connection.download}
            upload={connection.upload}
            metadata={connection.metadata}
            rule={connection.rule}
            rulePayload={connection.rulePayload}
            start={connection.start}
          />
        )
      })}
    </BasePage>
  )
}

export default Connections
