import { useEffect, useState } from 'react'
import MihomoIcon from './components/base/mihomo-icon'
import { calcTraffic } from './utils/calc'
import { showContextMenu, showMainWindow } from './utils/ipc'
import { useAppConfig } from './hooks/use-app-config'
import { useControledMihomoConfig } from './hooks/use-controled-mihomo-config'

const FloatingApp: React.FC = () => {
  const { appConfig } = useAppConfig()
  const { controledMihomoConfig } = useControledMihomoConfig()
  const { sysProxy } = appConfig || {}
  const { tun } = controledMihomoConfig || {}
  const sysProxyEnabled = sysProxy?.enable
  const tunEnabled = tun?.enable

  const [upload, setUpload] = useState(0)
  const [download, setDownload] = useState(0)
  useEffect(() => {
    window.electron.ipcRenderer.on('mihomoTraffic', async (_e, info: IMihomoTrafficInfo) => {
      setUpload(info.up)
      setDownload(info.down)
    })
    return (): void => {
      window.electron.ipcRenderer.removeAllListeners('mihomoTraffic')
    }
  }, [])
  return (
    <div className="app-drag p-[4px] h-[100vh]">
      <div className="floating-bg drop-shadow-md flex rounded-[calc(calc(100vh-8px)/2)] bg-content1 h-[calc(100vh-8px)] w-[calc(100vw-8px)]">
        <div className="flex justify-center items-center h-full w-[calc(100vh-8px)]">
          <div
            onContextMenu={(e) => {
              e.preventDefault()
              showContextMenu()
            }}
            onClick={() => {
              showMainWindow()
            }}
            className={`app-nodrag cursor-pointer floating-thumb ${tunEnabled ? 'bg-secondary' : sysProxyEnabled ? 'bg-primary' : 'bg-default'} hover:opacity-hover rounded-full h-[calc(100vh-14px)] w-[calc(100vh-14px)]`}
          >
            <MihomoIcon className="floating-icon text-primary-foreground h-full leading-full text-[22px] mx-auto" />
          </div>
        </div>
        <div className="flex flex-col justify-center w-[calc(100%-42px)]">
          <div className="flex justify-end">
            <div className="floating-text whitespace-nowrap overflow-hidden text-[12px] mr-[10px] font-bold">
              {calcTraffic(upload)}/s
            </div>
          </div>
          <div className="w-full flex justify-end">
            <div className="floating-text whitespace-nowrap overflow-hidden text-[12px] mr-[10px] font-bold">
              {calcTraffic(download)}/s
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FloatingApp
