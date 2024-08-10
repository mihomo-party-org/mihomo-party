import BasePage from '@renderer/components/base/base-page'
import { startMihomoLogs, stopMihomoLogs } from '@renderer/utils/ipc'
import LogItem from '@renderer/components/logs/log-item'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Input } from '@nextui-org/react'
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
    startMihomoLogs()
    window.electron.ipcRenderer.on('mihomoLogs', (_e, log: IMihomoLogInfo) => {
      log.time = new Date().toLocaleString()
      setLogs((prevLogs) => {
        return [...prevLogs, log]
      })
    })

    return (): void => {
      stopMihomoLogs()
      window.electron.ipcRenderer.removeAllListeners('mihomoLogs')
    }
  }, [])

  return (
    <BasePage title="实时日志">
      <div className="sticky top-[49px] z-40 backdrop-blur bg-background/40 flex p-2">
        <div className="w-full flex">
          <Input
            variant="bordered"
            size="sm"
            value={filter}
            placeholder="筛选过滤"
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
      </div>
      <Virtuoso
        autoFocus
        ref={virtuosoRef}
        style={{ height: 'calc(100vh - 100px)' }}
        totalCount={filteredLogs.length}
        itemContent={(index) => {
          const log = filteredLogs[index]
          return (
            <LogItem
              key={log.payload + index}
              time={log.time}
              type={log.type}
              payload={log.payload}
            />
          )
        }}
      />
    </BasePage>
  )
}

export default Logs
