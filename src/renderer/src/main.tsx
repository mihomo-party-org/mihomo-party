import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { NextUIProvider } from '@nextui-org/react'
import { init } from '@renderer/utils/init'
import '@renderer/assets/main.css'
import App from '@renderer/App'
import BaseErrorBoundary from './components/base/base-error-boundary'
import { AppConfigProvider } from './hooks/use-app-config'
import { ControledMihomoConfigProvider } from './hooks/use-controled-mihomo-config'
import { OverrideConfigProvider } from './hooks/use-override-config'
import { ProfileConfigProvider } from './hooks/use-profile-config'
import { RulesProvider } from './hooks/use-rules'
import { GroupsProvider } from './hooks/use-groups'

init().then(() => {
  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <NextUIProvider>
        <NextThemesProvider attribute="class" enableSystem defaultTheme="dark">
          <BaseErrorBoundary>
            <HashRouter>
              <AppConfigProvider>
                <ControledMihomoConfigProvider>
                  <ProfileConfigProvider>
                    <OverrideConfigProvider>
                      <GroupsProvider>
                        <RulesProvider>
                          <App />
                        </RulesProvider>
                      </GroupsProvider>
                    </OverrideConfigProvider>
                  </ProfileConfigProvider>
                </ControledMihomoConfigProvider>
              </AppConfigProvider>
            </HashRouter>
          </BaseErrorBoundary>
        </NextThemesProvider>
      </NextUIProvider>
    </React.StrictMode>
  )
})
