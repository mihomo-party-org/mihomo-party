import BasePage from '@renderer/components/base/base-page'
import { startMihomoLogs, stopMihomoLogs } from '@renderer/utils/ipc'
import { useEffect } from 'react'

const Logs: React.FC = () => {
  useEffect(() => {
    startMihomoLogs()
    window.electron.ipcRenderer.on('mihomoLogs', (_e, log: IMihomoLogInfo) => {
      console.log(log)
    })

    return (): void => {
      stopMihomoLogs()
      window.electron.ipcRenderer.removeAllListeners('mihomoTraffic')
    }
  }, [])

  return <BasePage title="实时日志"></BasePage>
}

export default Logs
