import { Button, Card, CardBody, CardFooter } from '@nextui-org/react'
import { FaCircleArrowDown, FaCircleArrowUp } from 'react-icons/fa6'
import { useLocation, useNavigate } from 'react-router-dom'
import { calcTraffic } from '@renderer/utils/calc'
import { useEffect, useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { IoLink } from 'react-icons/io5'
import Chart from 'react-apexcharts'
import { ApexOptions } from 'apexcharts'
import { useTheme } from 'next-themes'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { platform } from '@renderer/utils/init'

let currentUpload: number | undefined = undefined
let currentDownload: number | undefined = undefined
let hasShowTraffic = false
let drawing = false

const ConnCard: React.FC = () => {
  const { theme = 'system', systemTheme = 'dark' } = useTheme()
  const { appConfig } = useAppConfig()
  const { showTraffic } = appConfig || {}
  const navigate = useNavigate()
  const location = useLocation()
  const match = location.pathname.includes('/connections')

  const [upload, setUpload] = useState(0)
  const [download, setDownload] = useState(0)
  const {
    attributes,
    listeners,
    setNodeRef,
    transform: tf,
    transition,
    isDragging
  } = useSortable({
    id: 'connection'
  })
  const [series, setSeries] = useState([0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
  const getApexChartOptions = (): ApexOptions => {
    const islight = theme === 'system' ? systemTheme === 'light' : theme.includes('light')
    const primaryColor = match
      ? 'rgba(255,255,255,0.6)'
      : islight
        ? 'rgba(0,0,0,0.6)'
        : 'rgba(255,255,255,0.6)'
    const transparentColor = match
      ? 'rgba(255,255,255,0)'
      : islight
        ? 'rgba(0,0,0,0)'
        : 'rgba(255,255,255,0)'
    return {
      chart: {
        background: 'transparent',
        stacked: false,
        toolbar: {
          show: false
        },
        animations: {
          enabled: false
        },
        parentHeightOffset: 0,
        sparkline: {
          enabled: false
        }
      },
      colors: [primaryColor],
      stroke: {
        show: false,
        curve: 'smooth',
        width: 0
      },
      fill: {
        type: 'gradient',
        gradient: {
          type: 'vertical',
          shadeIntensity: 0,
          gradientToColors: [transparentColor, primaryColor],
          inverseColors: false,
          opacityTo: 0,
          stops: [0, 100]
        }
      },
      dataLabels: {
        enabled: false
      },
      plotOptions: {
        bar: {
          horizontal: false
        }
      },

      xaxis: {
        labels: {
          show: false
        },
        axisTicks: {
          show: false
        },
        axisBorder: {
          show: false
        }
      },
      yaxis: {
        labels: {
          show: false
        },
        min: 0
      },
      tooltip: {
        enabled: false
      },
      legend: {
        show: false
      },
      grid: {
        show: false,
        padding: {
          left: -10,
          right: 0,
          bottom: -15,
          top: 30
        },
        column: {
          opacity: 0
        },
        xaxis: {
          lines: {
            show: false
          }
        }
      }
    }
  }
  const transform = tf ? { x: tf.x, y: tf.y, scaleX: 1, scaleY: 1 } : null
  useEffect(() => {
    window.electron.ipcRenderer.on('mihomoTraffic', async (_e, info: IMihomoTrafficInfo) => {
      setUpload(info.up)
      setDownload(info.down)
      const data = series
      data.shift()
      data.push(info.up + info.down)
      setSeries([...data])
      if (platform === 'darwin' && showTraffic) {
        if (drawing) return
        drawing = true
        await drawSvg(info.up, info.down)
        hasShowTraffic = true
        drawing = false
      } else {
        if (!hasShowTraffic) return
        window.electron.ipcRenderer.send('trayIconUpdate', trayIconBase64)
        hasShowTraffic = false
      }
    })
    return (): void => {
      window.electron.ipcRenderer.removeAllListeners('mihomoTraffic')
    }
  }, [showTraffic])

  return (
    <div
      style={{
        position: 'relative',
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 'calc(infinity)' : undefined
      }}
      className="col-span-2"
    >
      <Card
        fullWidth
        className={`${match ? 'bg-primary' : ''}`}
        isPressable
        onPress={() => navigate('/connections')}
      >
        <CardBody className="pb-0 pt-0 px-0">
          <div ref={setNodeRef} {...attributes} {...listeners} className="flex justify-between">
            <Button
              isIconOnly
              className="bg-transparent pointer-events-none"
              variant="flat"
              color="default"
            >
              <IoLink
                color="default"
                className={`${match ? 'text-white' : 'text-foreground'} text-[24px]`}
              />
            </Button>
            <div className={`p-2 w-full ${match ? 'text-white' : 'text-foreground'} `}>
              <div className="flex justify-between">
                <div className="w-full text-right mr-2">{calcTraffic(upload)}/s</div>
                <FaCircleArrowUp className="h-[24px] leading-[24px]" />
              </div>
              <div className="flex justify-between">
                <div className="w-full text-right mr-2">{calcTraffic(download)}/s</div>
                <FaCircleArrowDown className="h-[24px] leading-[24px]" />
              </div>
            </div>
          </div>
        </CardBody>
        <CardFooter className="pt-1">
          <h3 className={`text-md font-bold ${match ? 'text-white' : 'text-foreground'}`}>连接</h3>
        </CardFooter>
      </Card>
      <div className="w-full h-full absolute top-0 left-0 pointer-events-none rounded-[14px] overflow-hidden">
        <Chart
          options={getApexChartOptions()}
          series={[{ name: 'Total', data: series }]}
          height={'100%'}
          width={'100%'}
          type="area"
        />
      </div>
    </div>
  )
}

export default ConnCard

const drawSvg = async (upload: number, download: number): Promise<void> => {
  if (upload === currentUpload && download === currentDownload) return
  currentUpload = upload
  currentDownload = download
  const svg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 156 36"><image height="36" width="36" href="${trayIconBase64}"/><text x="40" y="15" font-size="18" font-family="PingFang SC" font-weight="bold" text-anchor="start">↑</text><text x="40" y="34" font-size="18" font-family="PingFang SC" font-weight="bold" text-anchor="start">↓</text><text x="156" y="15" font-size="18" font-family="PingFang SC" font-weight="bold" text-anchor="end">${calcTraffic(upload)}/s</text><text x="156" y="34" font-size="18" font-family="PingFang SC" font-weight="bold" text-anchor="end">${calcTraffic(download)}/s</text></svg>`
  const image = await loadImage(svg)
  window.electron.ipcRenderer.send('trayIconUpdate', image)
}

const loadImage = (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = (): void => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      canvas.width = 156
      canvas.height = 36
      ctx?.drawImage(img, 0, 0)
      const png = canvas.toDataURL('image/png')
      resolve(png)
    }
    img.onerror = (): void => {
      reject()
    }
    img.src = url
  })
}

const trayIconBase64 = `data:image/png;base64,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`
