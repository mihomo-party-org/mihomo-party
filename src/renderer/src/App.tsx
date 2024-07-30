import { useTheme } from 'next-themes'
import { useEffect } from 'react'
import { useLocation, useNavigate, useRoutes } from 'react-router-dom'
import OutboundModeSwitcher from '@renderer/components/sider/outbound-mode-switcher'
import SysproxySwitcher from '@renderer/components/sider/sysproxy-switcher'
import TunSwitcher from '@renderer/components/sider/tun-switcher'
import { Button } from '@nextui-org/react'
import { IoSettings } from 'react-icons/io5'
import routes from '@renderer/routes'
import ProfileCard from '@renderer/components/sider/profile-card'
import ProxyCard from '@renderer/components/sider/proxy-card'
import RuleCard from '@renderer/components/sider/rule-card'
import OverrideCard from '@renderer/components/sider/override-card'
import ConnCard from '@renderer/components/sider/conn-card'
import LogCard from '@renderer/components/sider/log-card'

function App(): JSX.Element {
  const { setTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
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
      <div className="side w-[250px] h-full border-r border-default-200">
        <div className="flex justify-between h-[32px] m-2">
          <h3 className="select-none text-lg font-bold leading-[32px]">出站模式</h3>
          <Button
            size="sm"
            isIconOnly
            color={location.pathname.includes('/settings') ? 'primary' : 'default'}
            variant={location.pathname.includes('/settings') ? 'solid' : 'light'}
            onPress={() => {
              navigate('/settings')
            }}
            startContent={<IoSettings className="text-[20px]" />}
          />
        </div>
        <div className="mx-2">
          <OutboundModeSwitcher />
        </div>

        <h3 className="select-none text-lg font-bold m-2">代理模式</h3>
        <div className="flex justify-between mx-2">
          <SysproxySwitcher />
          <TunSwitcher />
        </div>
        <h3 className="select-none text-lg font-bold m-2">配置</h3>
        <div className="w-full h-[calc(100%-260px)] overflow-y-auto no-scrollbar">
          <div className="mx-2">
            <ProfileCard />
            <ProxyCard />
          </div>

          <div className="flex justify-between mx-2">
            <ConnCard />
            <LogCard />
          </div>
          <div className="flex justify-between mx-2">
            <RuleCard />
            <OverrideCard />
          </div>
        </div>
      </div>
      <div className="main w-[calc(100%-250px)] h-full overflow-y-auto">{page}</div>
    </div>
  )
}

export default App
