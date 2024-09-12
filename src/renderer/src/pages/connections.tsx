import BasePage from '@renderer/components/base/base-page'
import { mihomoCloseAllConnections, mihomoCloseConnection } from '@renderer/utils/ipc'
import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Divider, Input, Select, SelectItem } from '@nextui-org/react'
import { calcTraffic } from '@renderer/utils/calc'
import ConnectionItem from '@renderer/components/connections/connection-item'
import { Virtuoso } from 'react-virtuoso'
import dayjs from 'dayjs'
import ConnectionDetailModal from '@renderer/components/connections/connection-detail-modal'
import { CgClose } from 'react-icons/cg'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { HiSortAscending, HiSortDescending } from 'react-icons/hi'
import { includesIgnoreCase } from '@renderer/utils/includes'

let preData: IMihomoConnectionDetail[] = []

const Connections: React.FC = () => {
  const [filter, setFilter] = useState('')
  const { appConfig, patchAppConfig } = useAppConfig()
  const { connectionDirection = 'asc', connectionOrderBy = 'time' } = appConfig || {}
  const [connectionsInfo, setConnectionsInfo] = useState<IMihomoConnectionsInfo>()
  const [connections, setConnections] = useState<IMihomoConnectionDetail[]>([])
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [selected, setSelected] = useState<IMihomoConnectionDetail>()

  const filteredConnections = useMemo(() => {
    if (connectionOrderBy) {
      connections.sort((a, b) => {
        if (connectionDirection === 'asc') {
          switch (connectionOrderBy) {
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
        } else {
          switch (connectionOrderBy) {
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
        }
      })
    }
    if (filter === '') return connections
    return connections?.filter((connection) => {
      const raw = JSON.stringify(connection)
      return includesIgnoreCase(raw, filter)
    })
  }, [connections, filter, connectionDirection, connectionOrderBy])

  useEffect(() => {
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
          <Badge
            className="mt-2"
            color="primary"
            variant="flat"
            showOutline={false}
            content={`${filteredConnections.length}`}
          >
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
            selectedKeys={new Set([connectionOrderBy])}
            onSelectionChange={async (v) => {
              await patchAppConfig({
                connectionOrderBy: v.currentKey as
                  | 'time'
                  | 'upload'
                  | 'download'
                  | 'uploadSpeed'
                  | 'downloadSpeed'
              })
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
            isIconOnly
            className="bg-content2"
            onPress={async () => {
              patchAppConfig({
                connectionDirection: connectionDirection === 'asc' ? 'desc' : 'asc'
              })
            }}
          >
            {connectionDirection === 'asc' ? (
              <HiSortAscending className="text-lg" />
            ) : (
              <HiSortDescending className="text-lg" />
            )}
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
