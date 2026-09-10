import { useTheme } from 'next-themes'
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { NavigateFunction, useLocation, useNavigate, useRoutes } from 'react-router-dom'
import OutboundModeSwitcher from '@renderer/components/sider/outbound-mode-switcher'
import { Button, Divider } from '@heroui/react'
import { IoSettings } from 'react-icons/io5'
import routes, { useDeferredRoutePreload } from '@renderer/routes'
import UpdaterButton from '@renderer/components/updater/updater-button'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { applyTheme, setNativeTheme, setTitleBarOverlay } from '@renderer/utils/ipc'
import { platform } from '@renderer/utils/init'
import { TitleBarOverlayOptions } from 'electron'
import { useTrafficLogger } from '@renderer/hooks/use-traffic-logger'
import { useDnsOverrideAutoDisabledNotice } from '@renderer/hooks/use-dns-override-notice'
import { createTourDriver, getDriver, startTourIfNeeded } from '@renderer/utils/tour'
import { hasPendingPluginFile, subscribePluginFile } from '@renderer/utils/plugin-file-open'
import 'driver.js/dist/driver.css'
import { useTranslation } from 'react-i18next'
import { DEFAULT_ENABLE_TRAFFIC_LOGGER } from '../../shared/appConfig'
import MihomoIcon from './components/base/mihomo-icon'
import { getSiderCardByPath } from './utils/sider'
import { markInitialContentPartReady } from './utils/startup'

export { getDriver }

const siderCardsPromise = import('@renderer/components/sider/sider-cards')
const SiderCards = lazy(() => siderCardsPromise)

const FirstContentReady: React.FC = () => {
  const { appConfig } = useAppConfig()
  const location = useLocation()
  const sent = useRef(false)

  useEffect(() => {
    const ready = Boolean(appConfig) && location.pathname !== '/'
    if (!ready || sent.current) return
    sent.current = true
    markInitialContentPartReady('route')
  }, [appConfig, location.pathname])

  return null
}

const App: React.FC = () => {
  const { t } = useTranslation()
  const { appConfig, patchAppConfig } = useAppConfig()
  const hasAppConfig = Boolean(appConfig)
  const {
    enableTrafficLogger = DEFAULT_ENABLE_TRAFFIC_LOGGER,
    appTheme = 'system',
    customTheme,
    useWindowFrame = false,
    siderWidth = 250,
    lastSelectedSiderCard = 'proxy',
    rememberSelectedSiderCard = false
  } = appConfig || {}
  useTrafficLogger(enableTrafficLogger)
  useDnsOverrideAutoDisabledNotice()
  const narrowWidth = platform === 'darwin' ? 70 : 60
  const [siderWidthValue, setSiderWidthValue] = useState(siderWidth)
  const siderWidthValueRef = useRef(siderWidthValue)
  const [resizing, setResizing] = useState(false)
  const resizingRef = useRef(resizing)
  const tourInitialized = useRef(false)
  useDeferredRoutePreload()
  const { setTheme, systemTheme } = useTheme()
  const navigate: NavigateFunction = useNavigate()
  const location = useLocation()
  const page = useRoutes(routes)

  useEffect(() => {
    const openPluginImport = (): void => {
      navigate('/profiles')
    }
    const unsubscribe = subscribePluginFile(openPluginImport)
    if (hasPendingPluginFile()) openPluginImport()
    return unsubscribe
  }, [navigate])

  const setTitlebar = useCallback((): void => {
    if (!useWindowFrame && platform !== 'darwin') {
      const options = { height: 47 } as TitleBarOverlayOptions
      try {
        options.color = window.getComputedStyle(document.documentElement).backgroundColor
        options.symbolColor = window.getComputedStyle(document.documentElement).color
        setTitleBarOverlay(options)
      } catch {
        // ignore
      }
    }
  }, [useWindowFrame])

  useEffect(() => {
    setSiderWidthValue(siderWidth)
  }, [siderWidth])

  useEffect(() => {
    if (!hasAppConfig) return
    if (!rememberSelectedSiderCard) return
    const currentSiderCard = getSiderCardByPath(location.pathname)
    if (!currentSiderCard || currentSiderCard === lastSelectedSiderCard) return
    patchAppConfig({ lastSelectedSiderCard: currentSiderCard })
  }, [
    hasAppConfig,
    rememberSelectedSiderCard,
    lastSelectedSiderCard,
    location.pathname,
    patchAppConfig
  ])

  useEffect(() => {
    siderWidthValueRef.current = siderWidthValue
    resizingRef.current = resizing
  }, [siderWidthValue, resizing])

  const onResizeEnd = useCallback((): void => {
    if (resizingRef.current) {
      setResizing(false)
      patchAppConfig({ siderWidth: siderWidthValueRef.current })
    }
  }, [patchAppConfig])

  useEffect(() => {
    if (!tourInitialized.current) {
      tourInitialized.current = true
      createTourDriver(t, navigate)
      startTourIfNeeded()
    }
  }, [t, navigate])

  useEffect(() => {
    setNativeTheme(appTheme)
    setTheme(appTheme)
    setTitlebar()
  }, [appTheme, systemTheme, setTheme, setTitlebar])

  useEffect(() => {
    applyTheme(customTheme || 'default.css').then(() => {
      setTitlebar()
    })
  }, [customTheme, setTitlebar])

  useEffect(() => {
    window.addEventListener('mouseup', onResizeEnd)
    return (): void => window.removeEventListener('mouseup', onResizeEnd)
  }, [onResizeEnd])

  return (
    <div
      onMouseMove={(e) => {
        if (!resizing) return
        if (e.clientX <= 150) {
          setSiderWidthValue(narrowWidth)
        } else if (e.clientX <= 250) {
          setSiderWidthValue(250)
        } else if (e.clientX >= 400) {
          setSiderWidthValue(400)
        } else {
          setSiderWidthValue(e.clientX)
        }
      }}
      className={`w-full h-screen flex ${resizing ? 'cursor-ew-resize' : ''}`}
    >
      {siderWidthValue === narrowWidth ? (
        <div style={{ width: `${narrowWidth}px` }} className="side h-full flex flex-col">
          <div className="app-drag flex shrink-0 justify-center items-center z-40 bg-transparent h-11.25">
            {platform !== 'darwin' && <MihomoIcon className="h-8 leading-8 text-lg mx-px" />}
          </div>
          <Suspense fallback={<div className="min-h-0 flex-1" />}>
            <SiderCards iconOnly />
          </Suspense>
          <div className="px-2 pt-2 pb-4 flex shrink-0 flex-col items-center space-y-2">
            <UpdaterButton iconOnly={true} />
            <OutboundModeSwitcher iconOnly />
            <Button
              size="sm"
              className="app-nodrag"
              isIconOnly
              color={location.pathname.includes('/settings') ? 'primary' : 'default'}
              variant={location.pathname.includes('/settings') ? 'solid' : 'light'}
              onPress={() => {
                navigate('/settings')
              }}
            >
              <IoSettings className="text-[20px]" />
            </Button>
          </div>
        </div>
      ) : (
        <div
          style={{ width: `${siderWidthValue}px` }}
          className="side h-full overflow-y-auto no-scrollbar"
        >
          <div className="app-drag sticky top-0 z-40 backdrop-blur bg-transparent h-12.25">
            <div
              className={`flex justify-between p-2 ${!useWindowFrame && platform === 'darwin' ? 'ml-15' : ''}`}
            >
              <div className="flex ml-1">
                <MihomoIcon className="h-8 leading-8 text-lg mx-px" />
                <h3 className="text-lg font-bold leading-8">Clash Party</h3>
              </div>
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
              >
                <IoSettings className="text-[20px]" />
              </Button>
            </div>
          </div>
          <div className="mt-2 mx-2">
            <OutboundModeSwitcher />
          </div>
          <Suspense fallback={null}>
            <SiderCards />
          </Suspense>
        </div>
      )}

      <div
        onMouseDown={() => {
          setResizing(true)
        }}
        style={{
          position: 'fixed',
          zIndex: 50,
          left: `${siderWidthValue - 2}px`,
          width: '5px',
          height: '100vh',
          cursor: 'ew-resize'
        }}
        className={resizing ? 'bg-primary' : ''}
      />
      <Divider orientation="vertical" />
      <div
        style={{ width: `calc(100% - ${siderWidthValue + 1}px)` }}
        className="main grow h-full overflow-y-auto"
      >
        <Suspense fallback={<div className="h-full w-full bg-content1" />}>
          {page}
          <FirstContentReady />
        </Suspense>
      </div>
    </div>
  )
}

export default App
