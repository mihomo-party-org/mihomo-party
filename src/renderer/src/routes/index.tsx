import { Navigate } from 'react-router-dom'
import Overview from '@renderer/pages/overview'
import Proxies from '@renderer/pages/proxies'
import Rules from '@renderer/pages/rules'
import Settings from '@renderer/pages/settings'
import Profiles from '@renderer/pages/profiles'

const routes = [
  {
    path: '/overview',
    element: <Overview />
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
    path: '/profiles',
    element: <Profiles />
  },
  {
    path: '/settings',
    element: <Settings />
  },
  {
    path: '/',
    element: <Navigate to="/overview" />
  }
]

export default routes
