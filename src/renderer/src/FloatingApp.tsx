import { useEffect, useState } from 'react'
import MihomoIcon from './components/base/mihomo-icon'
import { calcTraffic } from './utils/calc'
import { showContextMenu, triggerMainWindow } from './utils/ipc'
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
    <div className="app-drag h-[100vh] w-[100vw]">
      <div className="floating-bg border-1 border-divider flex rounded-full bg-content1 h-[calc(100%-2px)] w-[calc(100%-2px)]">
        <div className="flex justify-center items-center h-[100%] aspect-square">
          <div
            onContextMenu={(e) => {
              e.preventDefault()
              showContextMenu()
            }}
            onClick={() => {
              triggerMainWindow()
            }}
            className={`app-nodrag cursor-pointer floating-thumb ${tunEnabled ? 'bg-secondary' : sysProxyEnabled ? 'bg-primary' : 'bg-default'} hover:opacity-hover rounded-full h-[calc(100%-4px)] aspect-square`}
          >
            <MihomoIcon className="floating-icon text-primary-foreground h-full leading-full text-[22px] mx-auto" />
          </div>
        </div>
        <div className="w-full overflow-hidden">
          <div className="flex flex-col justify-center h-full w-full">
            <h2 className="text-end floating-text whitespace-nowrap text-[12px] mr-2 font-bold">
              {calcTraffic(upload)}/s
            </h2>
            <h2 className="text-end floating-text whitespace-nowrap text-[12px] mr-2 font-bold">
              {calcTraffic(download)}/s
            </h2>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FloatingApp
