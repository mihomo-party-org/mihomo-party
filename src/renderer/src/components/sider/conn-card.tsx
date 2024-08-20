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

const ConnCard: React.FC = () => {
  const { theme = 'system', systemTheme = 'dark' } = useTheme()
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
    window.electron.ipcRenderer.on('mihomoTraffic', (_e, info: IMihomoTrafficInfo) => {
      setUpload(info.up)
      setDownload(info.down)
      const data = series
      data.shift()
      data.push(info.up + info.down)
      setSeries([...data])
    })
    return (): void => {
      window.electron.ipcRenderer.removeAllListeners('mihomoTraffic')
    }
  }, [])

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
