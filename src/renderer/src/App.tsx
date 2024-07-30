import { useTheme } from 'next-themes'
import { useEffect } from 'react'
import { useRoutes } from 'react-router-dom'
import OutboundModeSwitcher from '@renderer/components/sider/outbound-mode-switcher'
import SysproxySwitcher from '@renderer/components/sider/sysproxy-switcher'
import TunSwitcher from '@renderer/components/sider/tun-switcher'
import { Button } from '@nextui-org/react'
import { IoHome, IoSettings } from 'react-icons/io5'
import { IoWifi } from 'react-icons/io5'
import { IoGitNetwork } from 'react-icons/io5'
import { IoLogoGithub } from 'react-icons/io5'
import routes from '@renderer/routes'
import RouteItem from './components/sider/route-item'
import ProfileSwitcher from './components/sider/profile-switcher'

function App(): JSX.Element {
  const { setTheme } = useTheme()

  const page = useRoutes(routes)

  useEffect(() => {
    try {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        setTheme('dark')
      } else {
        setTheme('light')
      }
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (e.matches) {
          setTheme('dark')
        } else {
          setTheme('light')
        }
      })
    } catch {
      throw new Error('Failed to set theme')
    }
  }, [])

  return (
    <div className="w-full h-[100vh] flex">
      <div className="side w-[250px] h-full p-2 border-r border-neutral-700">
        <div className="flex justify-between h-[32px] mb-2">
          <h3 className="select-none text-lg font-bold leading-[32px]">出站</h3>
          <Button
            size="sm"
            isIconOnly
            variant="light"
            onPress={() => {
              open('https://github.com/pompurin404/mihomo-party')
            }}
            startContent={<IoLogoGithub className="text-[20px]" />}
          />
        </div>

        <OutboundModeSwitcher />
        <h3 className="select-none text-lg font-bold my-2">代理</h3>
        <div className="flex justify-between">
          <SysproxySwitcher />
          <TunSwitcher />
        </div>
        <h3 className="select-none text-lg font-bold my-2">配置</h3>
        <ProfileSwitcher />
        <RouteItem title="概览" pathname="/overview" icon={IoHome} />
        <RouteItem title="代理" pathname="/proxies" icon={IoWifi} />
        <RouteItem title="规则" pathname="/rules" icon={IoGitNetwork} />
        <RouteItem title="设置" pathname="/settings" icon={IoSettings} />
      </div>
      <div className="main w-[calc(100%-250px)] h-full overflow-y-auto">{page}</div>
    </div>
  )
}

export default App
