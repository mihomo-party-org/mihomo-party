import { useTheme } from 'next-themes'
import { useEffect } from 'react'
import { useLocation, useNavigate, useRoutes } from 'react-router-dom'
import OutboundModeSwitcher from '@renderer/components/sider/outbound-mode-switcher'
import SysproxySwitcher from '@renderer/components/sider/sysproxy-switcher'
import TunSwitcher from '@renderer/components/sider/tun-switcher'
import { Button, Divider } from '@nextui-org/react'
import { IoSettings } from 'react-icons/io5'
import routes from '@renderer/routes'
import ProfileCard from '@renderer/components/sider/profile-card'
import ProxyCard from '@renderer/components/sider/proxy-card'
import RuleCard from '@renderer/components/sider/rule-card'
import OverrideCard from '@renderer/components/sider/override-card'
import ConnCard from '@renderer/components/sider/conn-card'
import LogCard from '@renderer/components/sider/log-card'
import MihomoCoreCard from './components/sider/mihomo-core-card.tsx'
import TestCard from './components/sider/test-card.js'
import UpdaterButton from './components/updater/updater-button.js'

const App: React.FC = () => {
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
      <div className="side w-[250px] h-full overflow-y-auto no-scrollbar">
        <div className="sticky top-0 z-40 backdrop-blur bg-background/40 h-[48px]">
          <div className="flex justify-between p-2">
            <h3 className="select-none text-lg font-bold leading-[32px]">Mihomo Party</h3>
            <UpdaterButton />
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
        </div>
        <div className="m-2">
          <OutboundModeSwitcher />
        </div>
        <div className="flex justify-between mx-2 mb-2">
          <SysproxySwitcher />
          <TunSwitcher />
        </div>
        <div className="mx-2">
          <ProfileCard />
          <ProxyCard />
          <MihomoCoreCard />
          <ConnCard />
        </div>

        <div className="flex justify-between mx-2">
          <LogCard />
          <RuleCard />
        </div>
        <div className="flex justify-between mx-2">
          <TestCard />
          <OverrideCard />
        </div>
      </div>
      <Divider orientation="vertical" />
      <div className="main w-[calc(100%-251px)] h-full overflow-y-auto">{page}</div>
    </div>
  )
}

export default App
