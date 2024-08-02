import BasePage from '@renderer/components/base/base-page'
import { startMihomoLogs, stopMihomoLogs } from '@renderer/utils/ipc'
import LogItem from '@renderer/components/logs/log-item'
import { useEffect, useMemo, useState } from 'react'
import { Input } from '@nextui-org/react'

const Logs: React.FC = () => {
  const [logs, setLogs] = useState<IMihomoLogInfo[]>([])
  const [filter, setFilter] = useState('')

  const filteredLogs = useMemo(() => {
    if (filter === '') return logs
    return logs.filter((log) => {
      return log.payload.includes(filter)
    })
  }, [logs, filter])

  useEffect(() => {
    startMihomoLogs()
    window.electron.ipcRenderer.on('mihomoLogs', (_e, log: IMihomoLogInfo) => {
      log.time = new Date().toISOString()
      setLogs((prevLogs) => {
        if (prevLogs.length >= 200) {
          prevLogs.shift()
        }
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
      <div className="sticky top-[48px] z-40 backdrop-blur bg-background/40 flex p-2">
        <Input
          variant="bordered"
          size="sm"
          value={filter}
          placeholder="筛选过滤"
          onValueChange={setFilter}
        />
      </div>
      {filteredLogs.map((log, index) => {
        return (
          <LogItem
            key={log.payload + index}
            time={log.time}
            type={log.type}
            payload={log.payload}
          />
        )
      })}
    </BasePage>
  )
}

export default Logs
