import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useRoutes } from 'react-router-dom'
import OutboundModeSwitcher from '@renderer/components/sider/outbound-mode-switcher'
import SysproxySwitcher from '@renderer/components/sider/sysproxy-switcher'
import TunSwitcher from '@renderer/components/sider/tun-switcher'
import { Button, Divider } from '@nextui-org/react'
import { IoSettings } from 'react-icons/io5'
import routes from '@renderer/routes'
import {
  DndContext,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core'
import { SortableContext } from '@dnd-kit/sortable'
import ProfileCard from '@renderer/components/sider/profile-card'
import ProxyCard from '@renderer/components/sider/proxy-card'
import RuleCard from '@renderer/components/sider/rule-card'
import DNSCard from '@renderer/components/sider/dns-card'
import SniffCard from '@renderer/components/sider/sniff-card'
import OverrideCard from '@renderer/components/sider/override-card'
import ConnCard from '@renderer/components/sider/conn-card'
import LogCard from '@renderer/components/sider/log-card'
import MihomoCoreCard from '@renderer/components/sider/mihomo-core-card'
import ResourceCard from '@renderer/components/sider/resource-card'
import UpdaterButton from '@renderer/components/updater/updater-button'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { setNativeTheme, setTitleBarOverlay } from '@renderer/utils/ipc'
import { platform } from '@renderer/utils/init'
import { TitleBarOverlayOptions } from 'electron'
import SubStoreCard from '@renderer/components/sider/substore-card'

const App: React.FC = () => {
  const { appConfig, patchAppConfig } = useAppConfig()
  const {
    appTheme = 'system',
    useWindowFrame = false,
    siderOrder = [
      'sysproxy',
      'tun',
      'profile',
      'proxy',
      'rule',
      'resource',
      'override',
      'connection',
      'mihomo',
      'dns',
      'sniff',
      'log',
      'substore'
    ]
  } = appConfig || {}
  const [order, setOrder] = useState(siderOrder)
  const sensors = useSensors(useSensor(PointerSensor))
  const { setTheme, systemTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const page = useRoutes(routes)

  useEffect(() => {
    setOrder(siderOrder)
  }, [siderOrder])

  useEffect(() => {
    if (appTheme.includes('light')) {
      setNativeTheme('light')
    } else if (appTheme === 'system') {
      setNativeTheme('system')
    } else {
      setNativeTheme('dark')
    }
    setTheme(appTheme)
    if (!useWindowFrame) {
      let theme = appTheme as string
      if (appTheme === 'system') {
        theme = systemTheme || 'light'
      }
      const options = { height: 48 } as TitleBarOverlayOptions
      try {
        if (platform !== 'darwin') {
          if (theme.includes('light')) {
            options.color = '#FFFFFF'
            options.symbolColor = '#000000'
          } else if (theme.includes('dark')) {
            options.color = '#000000'
            options.symbolColor = '#FFFFFF'
          } else {
            options.color = '#18181b'
            options.symbolColor = '#FFFFFF'
          }
        }
        setTitleBarOverlay(options)
      } catch (e) {
        // ignore
      }
    }
  }, [appTheme, systemTheme])

  const onDragEnd = async (event: DragEndEvent): Promise<void> => {
    const { active, over } = event
    if (over) {
      if (active.id !== over.id) {
        const newOrder = order.slice()
        const activeIndex = newOrder.indexOf(active.id as string)
        const overIndex = newOrder.indexOf(over.id as string)
        newOrder.splice(activeIndex, 1)
        newOrder.splice(overIndex, 0, active.id as string)
        setOrder(newOrder)
        await patchAppConfig({ siderOrder: newOrder })
      }
    }
    navigate(navigateMap[active.id as string])
  }

  const navigateMap = {
    sysproxy: "sysproxy",
    tun: "tun",
    profile: "profiles",
    proxy: "proxies",
    mihomo: "mihomo",
    connection: "connections",
    dns: "dns",
    sniff: "sniffer",
    log: "logs",
    rule: "rules",
    resource: "resources",
    override: "override"
  }

  const componentMap = {
    sysproxy: <SysproxySwitcher key="sysproxy" />,
    tun: <TunSwitcher key="tun" />,
    profile: <ProfileCard key="profile" />,
    proxy: <ProxyCard key="proxy" />,
    mihomo: <MihomoCoreCard key="mihomo" />,
    connection: <ConnCard key="connection" />,
    dns: <DNSCard key="dns" />,
    sniff: <SniffCard key="sniff" />,
    log: <LogCard key="log" />,
    rule: <RuleCard key="rule" />,
    resource: <ResourceCard key="resource" />,
    override: <OverrideCard key="override" />,
    substore: <SubStoreCard key="substore" />
  }

  return (
    <div className="w-full h-[100vh] flex">
      <div className="side w-[250px] h-full overflow-y-auto no-scrollbar">
        <div className="app-drag sticky top-0 z-40 backdrop-blur bg-background/40 h-[49px]">
          <div className="flex justify-between p-2">
            <h3
              className={`text-lg font-bold leading-[32px] ${!useWindowFrame && platform === 'darwin' ? 'invisible' : ''}`}
            >
              Mihomo Party
            </h3>
            <UpdaterButton />
            <Button
              size="sm"
              className="app-nodrag"
              isIconOnly
              color={location.pathname.includes('/settings') ? 'primary' : 'default'}
              variant={location.pathname.includes('/settings') ? 'solid' : 'light'}
              onPress={() => {
                navigate('/settings')
              }}
              startContent={<IoSettings className="text-[20px]" />}
            />
          </div>
        </div>
        <div className="mt-2 mx-2">
          <OutboundModeSwitcher />
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
          <div className="grid grid-cols-2 gap-2 m-2">
            <SortableContext items={order}>
              {order.map((key: string) => {
                return componentMap[key]
              })}
            </SortableContext>
          </div>
        </DndContext>
      </div>
      <Divider orientation="vertical" />
      <div className="main w-[calc(100%-251px)] h-full overflow-y-auto">{page}</div>
    </div>
  )
}

export default App
