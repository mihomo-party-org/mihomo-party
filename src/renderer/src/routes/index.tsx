import { Navigate } from 'react-router-dom'
import Override from '@renderer/pages/override'
import Proxies from '@renderer/pages/proxies'
import Rules from '@renderer/pages/rules'
import Settings from '@renderer/pages/settings'
import Profiles from '@renderer/pages/profiles'
import Logs from '@renderer/pages/logs'
import Connections from '@renderer/pages/connections'
import Mihomo from '@renderer/pages/mihomo'
import Sysproxy from '@renderer/pages/syspeoxy'
import Tun from '@renderer/pages/tun'
import Tests from '@renderer/pages/tests'

const routes = [
  {
    path: '/mihomo',
    element: <Mihomo />
  },
  {
    path: '/sysproxy',
    element: <Sysproxy />
  },
  {
    path: '/tun',
    element: <Tun />
  },
  {
    path: '/proxies',
    element: <Proxies />
  },
  {
    path: '/rules',
    element: <Rules />
  },
  {
    path: '/tests',
    element: <Tests />
  },
  {
    path: '/logs',
    element: <Logs />
  },
  {
    path: '/connections',
    element: <Connections />
  },
  {
    path: '/override',
    element: <Override />
  },
  {
    path: '/profiles',
    element: <Profiles />
  },
  {
    path: '/settings',
    element: <Settings />
  },
  {
    path: '/',
    element: <Navigate to="/proxies" />
  }
]

export default routes
