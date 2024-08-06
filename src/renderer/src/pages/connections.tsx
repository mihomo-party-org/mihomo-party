import BasePage from '@renderer/components/base/base-page'
import {
  mihomoCloseAllConnections,
  mihomoCloseConnection,
  startMihomoConnections,
  stopMihomoConnections
} from '@renderer/utils/ipc'
import { Key, useEffect, useMemo, useState } from 'react'
import { Button, Input } from '@nextui-org/react'
import { IoCloseCircle } from 'react-icons/io5'
import { calcTraffic } from '@renderer/utils/calc'
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from '@nextui-org/react'
import dayjs from 'dayjs'
import ConnectionDetailModal from '@renderer/components/connections/connection-detail-modal'

let preData: IMihomoConnectionDetail[] = []

const Connections: React.FC = () => {
  const [filter, setFilter] = useState('')
  const [connectionsInfo, setConnectionsInfo] = useState<IMihomoConnectionsInfo>()
  const [connections, setConnections] = useState<IMihomoConnectionDetail[]>([])
  const [selectedConnection, setSelectedConnection] = useState<IMihomoConnectionDetail>()
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [sortKey, setSortKey] = useState('')
  const [descend, setDescend] = useState(false)

  const filteredConnections = useMemo(() => {
    if (filter === '') return connections
    return connections?.filter((connection) => {
      const raw = JSON.stringify(connection)
      return raw.includes(filter)
    })
  }, [connections, filter])

  const sortedConnections = useMemo(() => {
    if (sortKey === '') return filteredConnections
    return filteredConnections.sort((a, b) => {
      const localA = a[sortKey] ? a[sortKey] : a.metadata[sortKey]
      const localB = b[sortKey] ? b[sortKey] : b.metadata[sortKey]
      if (descend) {
        if (typeof localA === 'string') {
          return localB.localeCompare(localA)
        }
        return localB - localA
      } else {
        if (typeof localA === 'string') {
          return localA.localeCompare(localB)
        }
        return localA - localB
      }
    })
  }, [filteredConnections, sortKey, descend])

  useEffect(() => {
    startMihomoConnections()
    window.electron.ipcRenderer.on('mihomoConnections', (_e, info: IMihomoConnectionsInfo) => {
      setConnectionsInfo(info)
      const newConns: IMihomoConnectionDetail[] = []
      for (const conn of info.connections ?? []) {
        const preConn = preData?.find((c) => c.id === conn.id)

        if (preConn) {
          conn.downloadSpeed = conn.download - preConn.download
          conn.uploadSpeed = conn.upload - preConn.upload
        }
        newConns.push(conn)
      }
      setConnections(newConns)
      preData = newConns
    })

    return (): void => {
      stopMihomoConnections()
      window.electron.ipcRenderer.removeAllListeners('mihomoConnections')
    }
  }, [])

  return (
    <BasePage
      title="连接"
      header={
        <div className="flex">
          <div className="flex items-center">
            <span className="mx-1 text-gray-400">
              下载: {calcTraffic(connectionsInfo?.downloadTotal ?? 0)}{' '}
            </span>
            <span className="mx-1 text-gray-400">
              上传: {calcTraffic(connectionsInfo?.uploadTotal ?? 0)}{' '}
            </span>
          </div>
          <Button
            className="ml-1"
            size="sm"
            color="primary"
            onPress={() => mihomoCloseAllConnections()}
          >
            关闭所有连接
          </Button>
        </div>
      }
    >
      {isDetailModalOpen && selectedConnection && (
        <ConnectionDetailModal
          onClose={() => setIsDetailModalOpen(false)}
          connection={selectedConnection}
        />
      )}
      <div className="overflow-x-auto sticky top-[49px] z-40 backdrop-blur bg-background/40 flex p-2">
        <Input
          variant="bordered"
          size="sm"
          value={filter}
          placeholder="筛选过滤"
          onValueChange={setFilter}
        />
      </div>
      <Table
        onRowAction={(id: Key) => {
          setSelectedConnection(connections.find((c) => c.id === (id as string)))
          setIsDetailModalOpen(true)
        }}
        sortDescriptor={{ column: sortKey, direction: descend ? 'descending' : 'ascending' }}
        onSortChange={(desc) => {
          setSortKey(desc.column as string)
          setDescend(desc.direction !== 'ascending')
        }}
        isHeaderSticky
        isStriped
        className="h-[calc(100vh-100px)] p-2"
      >
        <TableHeader>
          <TableColumn key="type" allowsSorting>
            类型
          </TableColumn>
          <TableColumn key="process" allowsSorting>
            进程
          </TableColumn>
          <TableColumn key="host" allowsSorting>
            主机
          </TableColumn>
          <TableColumn key="sniffer" allowsSorting>
            嗅探域名
          </TableColumn>
          <TableColumn key="rule" allowsSorting>
            规则
          </TableColumn>
          <TableColumn key="chains" width={500}>
            链路
          </TableColumn>
          <TableColumn key="download" allowsSorting>
            下载量
          </TableColumn>
          <TableColumn key="upload" allowsSorting>
            上传量
          </TableColumn>
          <TableColumn key="downloadSpeed" allowsSorting>
            下载速度
          </TableColumn>
          <TableColumn key="uploadSpeed" allowsSorting>
            上传速度
          </TableColumn>
          <TableColumn key="start" allowsSorting>
            连接时间
          </TableColumn>
          <TableColumn key="sourceIp">源地址</TableColumn>
          <TableColumn key="sourcePort">源端口</TableColumn>
          <TableColumn key="inboundUser">入站用户</TableColumn>
          <TableColumn key="close">关闭连接</TableColumn>
        </TableHeader>
        <TableBody items={sortedConnections ?? []}>
          {(item) => (
            <TableRow key={item.id}>
              <TableCell className="max-w-[10px]">
                {item.metadata.type}({item.metadata.network})
              </TableCell>
              <TableCell>{item.metadata.process}</TableCell>
              <TableCell className="max-w-[200px] text-ellipsis whitespace-nowrap overflow-hidden">
                {item.metadata.host}
              </TableCell>
              <TableCell className="max-w-[200px] text-ellipsis whitespace-nowrap overflow-hidden">
                {item.metadata.sniffHost ?? '-'}
              </TableCell>
              <TableCell className="max-w-[200px] text-ellipsis whitespace-nowrap overflow-hidden">
                {item.rule}:{item.rulePayload}
              </TableCell>
              <TableCell className="max-w-[200px] text-ellipsis whitespace-nowrap overflow-hidden">
                {item.chains.reverse().join('::')}
              </TableCell>
              <TableCell className="whitespace-nowrap">{calcTraffic(item.download)}</TableCell>
              <TableCell className="whitespace-nowrap">{calcTraffic(item.upload)}</TableCell>
              <TableCell className="whitespace-nowrap">
                {calcTraffic(item.downloadSpeed ?? 0)}/s
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {calcTraffic(item.uploadSpeed ?? 0)}/s
              </TableCell>
              <TableCell className="whitespace-nowrap">{dayjs(item.start).fromNow()}</TableCell>
              <TableCell className="whitespace-nowrap">{item.metadata.sourceIP}</TableCell>
              <TableCell className="whitespace-nowrap">{item.metadata.sourcePort}</TableCell>
              <TableCell className="whitespace-nowrap">{item.metadata.inboundUser}</TableCell>
              <TableCell>
                <Button
                  isIconOnly
                  size="sm"
                  color="danger"
                  variant="light"
                  onPress={() => mihomoCloseConnection(item.id)}
                >
                  <IoCloseCircle className="text-lg" />
                </Button>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {/* {filteredConnections?.map((connection) => {
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
      })} */}
    </BasePage>
  )
}

export default Connections
