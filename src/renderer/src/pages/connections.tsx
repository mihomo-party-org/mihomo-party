import BasePage from '@renderer/components/base/base-page'
import {
  mihomoCloseAllConnections,
  mihomoCloseConnection,
  startMihomoConnections,
  stopMihomoConnections
} from '@renderer/utils/ipc'
import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Divider, Input, Select, SelectItem } from '@nextui-org/react'
import { calcTraffic } from '@renderer/utils/calc'
import ConnectionItem from '@renderer/components/connections/connection-item'
import { Virtuoso } from 'react-virtuoso'
import dayjs from 'dayjs'
import ConnectionDetailModal from '@renderer/components/connections/connection-detail-modal'
import { CgClose } from 'react-icons/cg'

let preData: IMihomoConnectionDetail[] = []

const Connections: React.FC = () => {
  const [filter, setFilter] = useState('')
  const [connectionsInfo, setConnectionsInfo] = useState<IMihomoConnectionsInfo>()
  const [connections, setConnections] = useState<IMihomoConnectionDetail[]>([])
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [selected, setSelected] = useState<IMihomoConnectionDetail>()
  const [direction, setDirection] = useState(true)
  const [sortBy, setSortBy] = useState('time')
  const filteredConnections = useMemo(() => {
    if (sortBy) {
      connections.sort((a, b) => {
        if (direction) {
          switch (sortBy) {
            case 'time':
              return dayjs(b.start).unix() - dayjs(a.start).unix()
            case 'upload':
              return a.upload - b.upload
            case 'download':
              return a.download - b.download
            case 'uploadSpeed':
              return (a.uploadSpeed || 0) - (b.uploadSpeed || 0)
            case 'downloadSpeed':
              return (a.downloadSpeed || 0) - (b.downloadSpeed || 0)
          }
          return 0
        } else {
          switch (sortBy) {
            case 'time':
              return dayjs(a.start).unix() - dayjs(b.start).unix()
            case 'upload':
              return b.upload - a.upload
            case 'download':
              return b.download - a.download
            case 'uploadSpeed':
              return (b.uploadSpeed || 0) - (a.uploadSpeed || 0)
            case 'downloadSpeed':
              return (b.downloadSpeed || 0) - (a.downloadSpeed || 0)
          }
          return 0
        }
      })
    }
    if (filter === '') return connections
    return connections?.filter((connection) => {
      const raw = JSON.stringify(connection)
      return raw.includes(filter)
    })
  }, [connections, filter])

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
              ↑ {calcTraffic(connectionsInfo?.uploadTotal ?? 0)}{' '}
            </span>
            <span className="mx-1 text-gray-400">
              ↓ {calcTraffic(connectionsInfo?.downloadTotal ?? 0)}{' '}
            </span>
          </div>
          <Badge color="primary" variant="flat" content={`${filteredConnections.length}`}>
            <Button
              className="app-nodrag ml-1"
              title="关闭全部连接"
              isIconOnly
              size="sm"
              variant="light"
              onPress={() => {
                if (filter === '') {
                  mihomoCloseAllConnections()
                } else {
                  filteredConnections.forEach((conn) => {
                    mihomoCloseConnection(conn.id)
                  })
                }
              }}
            >
              <CgClose className="text-lg" />
            </Button>
          </Badge>
        </div>
      }
    >
      {isDetailModalOpen && selected && (
        <ConnectionDetailModal onClose={() => setIsDetailModalOpen(false)} connection={selected} />
      )}
      <div className="overflow-x-auto sticky top-0 z-40">
        <div className="flex p-2 gap-2">
          <Input
            variant="flat"
            size="sm"
            value={filter}
            placeholder="筛选过滤"
            isClearable
            onValueChange={setFilter}
          />

          <Select
            size="sm"
            className="w-[180px]"
            selectedKeys={new Set([sortBy])}
            onSelectionChange={async (v) => {
              setSortBy(v.currentKey as string)
            }}
          >
            <SelectItem key="upload">上传量</SelectItem>
            <SelectItem key="download">下载量</SelectItem>
            <SelectItem key="uploadSpeed">上传速度</SelectItem>
            <SelectItem key="downloadSpeed">下载速度</SelectItem>
            <SelectItem key="time">时间</SelectItem>
          </Select>
          <Button
            size="sm"
            onPress={() => {
              setDirection((pre) => !pre)
            }}
          >
            {direction ? '升序' : '降序'}
          </Button>
        </div>
        <Divider />
      </div>
      <div className="h-[calc(100vh-100px)] mt-[1px]">
        <Virtuoso
          data={filteredConnections}
          itemContent={(i, connection) => (
            <ConnectionItem
              setSelected={setSelected}
              setIsDetailModalOpen={setIsDetailModalOpen}
              selected={selected}
              close={mihomoCloseConnection}
              index={i}
              key={connection.id}
              info={connection}
            />
          )}
        />
      </div>
    </BasePage>
  )
}

export default Connections
