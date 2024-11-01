import BasePage from '@renderer/components/base/base-page'
import LogItem from '@renderer/components/logs/log-item'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Divider, Input, Select, SelectItem } from '@nextui-org/react'
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso'
import { IoLocationSharp } from 'react-icons/io5'
import { CgTrash } from 'react-icons/cg'

import { includesIgnoreCase } from '@renderer/utils/includes'
let memoTrace = true

const cachedLogs: {
  log: IMihomoLogInfo[]
  trigger: ((i: IMihomoLogInfo[]) => void) | null
  clean: () => void
} = {
  log: [],
  trigger: null,
  clean(): void {
    this.log = []
    if (this.trigger !== null) {
      this.trigger(this.log)
    }
  }
}

window.electron.ipcRenderer.on('mihomoLogs', (_e, log: IMihomoLogInfo) => {
  log.time = new Date().toLocaleString()
  cachedLogs.log.push(log)
  if (cachedLogs.log.length >= 500) {
    cachedLogs.log.shift()
  }
  if (cachedLogs.trigger !== null) {
    cachedLogs.trigger(cachedLogs.log)
  }
})
let memoLogLevel = new Set<LogLevel>()

const Logs: React.FC = () => {
  const [logs, setLogs] = useState<IMihomoLogInfo[]>(cachedLogs.log)
  const [filter, setFilter] = useState('')
  const [trace, setTrace] = useState(memoTrace)
  const handleSeTrace = (e: boolean): void => {
    const next = !e
    setTrace(next)
    memoTrace = next
  }

  const [logLevel, setLogLevel] = useState(memoLogLevel)

  const handleSetLogLevel = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    const t = e.target.value
    const nextLogLevel =
      t === '' ? new Set<LogLevel>(null) : new Set(t.split(',').map((e) => e as LogLevel))

    setLogLevel(nextLogLevel)
    memoLogLevel = nextLogLevel
  }

  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const filteredLogs = useMemo(() => {
    if (logLevel.size === 0 && filter === '') {
      return logs
    }
    return logs.filter((log) => {
      const lv = logLevel.size > 0 ? logLevel.has(log.type) : true
      const match = includesIgnoreCase(log.payload, filter) || includesIgnoreCase(log.time, filter)
      return lv && match
    })
  }, [logs, filter, logLevel])

  useEffect(() => {
    if (!trace) return
    // not work well with initialTopMostItemIndex
    const id = setTimeout(() => {
      virtuosoRef.current?.scrollToIndex({
        index: filteredLogs.length - 1,
        behavior: 'smooth',
        align: 'end',
        offset: 0
      })
    }, 50)
    return (): void => clearTimeout(id)
  }, [filteredLogs, trace])

  useEffect(() => {
    const old = cachedLogs.trigger
    cachedLogs.trigger = (a): void => {
      setLogs([...a])
    }
    return (): void => {
      cachedLogs.trigger = old
    }
  }, [])

  return (
    <BasePage title="实时日志">
      <div className="sticky top-0 z-40">
        <div className="w-full flex p-2">
          <Select
            classNames={{ trigger: 'data-[hover=true]:bg-default-200' }}
            className="w-[150px]"
            placeholder="日志等级"
            size="sm"
            selectedKeys={logLevel}
            selectionMode="multiple"
            onChange={handleSetLogLevel}
          >
            <SelectItem key="error">错误</SelectItem>
            <SelectItem key="warning">警告</SelectItem>
            <SelectItem key="info">信息</SelectItem>
            <SelectItem key="debug">调试</SelectItem>
          </Select>
          <Input
            size="sm"
            value={filter}
            placeholder="筛选过滤"
            isClearable
            onValueChange={setFilter}
          />
          <Button
            size="sm"
            isIconOnly
            className="ml-2"
            color={trace ? 'primary' : 'default'}
            variant={trace ? 'solid' : 'bordered'}
            onPress={() => {
              handleSeTrace(trace)
            }}
          >
            <IoLocationSharp className="text-lg" />
          </Button>
          <Button
            size="sm"
            isIconOnly
            title="清空日志"
            className="ml-2"
            variant="light"
            color="danger"
            onPress={() => {
              cachedLogs.clean()
            }}
          >
            <CgTrash className="text-lg" />
          </Button>
        </div>
        <Divider />
      </div>
      <div className="h-[calc(100vh-100px)] mt-[1px]">
        <Virtuoso
          ref={virtuosoRef}
          data={filteredLogs}
          initialTopMostItemIndex={filteredLogs.length - 1}
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
