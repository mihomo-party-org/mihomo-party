import BasePage from '@renderer/components/base/base-page'
import LogItem from '@renderer/components/logs/log-item'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Divider, Input } from '@nextui-org/react'
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso'

const Logs: React.FC = () => {
  const [logs, setLogs] = useState<IMihomoLogInfo[]>([])
  const [filter, setFilter] = useState('')
  const [trace, setTrace] = useState(true)

  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const filteredLogs = useMemo(() => {
    if (filter === '') return logs
    return logs.filter((log) => {
      return log.payload.includes(filter) || log.type.includes(filter)
    })
  }, [logs, filter])

  useEffect(() => {
    if (!trace) return
    virtuosoRef.current?.scrollToIndex({
      index: filteredLogs.length - 1,
      behavior: 'smooth',
      align: 'end',
      offset: 0
    })
  }, [filteredLogs, trace])

  useEffect(() => {
    window.electron.ipcRenderer.on('mihomoLogs', (_e, log: IMihomoLogInfo) => {
      log.time = new Date().toLocaleString()
      setLogs((prevLogs) => {
        return [...prevLogs, log]
      })
    })

    return (): void => {
      window.electron.ipcRenderer.removeAllListeners('mihomoLogs')
    }
  }, [])

  return (
    <BasePage title="实时日志">
      <div className="sticky top-0 z-40">
        <div className="w-full flex p-2">
          <Input
            size="sm"
            value={filter}
            placeholder="筛选过滤"
            isClearable
            onValueChange={setFilter}
          />
          <Button
            size="sm"
            className="ml-2"
            color={trace ? 'primary' : 'default'}
            variant={trace ? 'solid' : 'bordered'}
            onPress={() => {
              setTrace((prev) => !prev)
            }}
          >
            追踪
          </Button>
        </div>
        <Divider />
      </div>
      <div className="h-[calc(100vh-100px)] mt-[1px]">
        <Virtuoso
          ref={virtuosoRef}
          data={filteredLogs}
          itemContent={(i, log) => {
            return (
              <LogItem
                index={i}
                key={log.payload + i}
                time={log.time}
                type={log.type}
                payload={log.payload}
              />
            )
          }}
        />
      </div>
    </BasePage>
  )
}

export default Logs
