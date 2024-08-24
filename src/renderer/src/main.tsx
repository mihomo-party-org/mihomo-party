import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { NextUIProvider } from '@nextui-org/react'
import { init, platform } from '@renderer/utils/init'
import '@renderer/assets/main.css'
import App from '@renderer/App'
import BaseErrorBoundary from './components/base/base-error-boundary'
import { quitApp } from './utils/ipc'

init().then(() => {
  document.addEventListener('keydown', (e) => {
    if (platform !== 'darwin' && e.ctrlKey && e.key === 'q') {
      e.preventDefault()
      quitApp()
    }
    if (platform === 'darwin' && e.metaKey && e.key === 'q') {
      e.preventDefault()
      quitApp()
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      window.close()
    }
  })
  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <NextUIProvider>
        <NextThemesProvider
          attribute="class"
          themes={[
            'light',
            'dark',
            'gray',
            'light-pink',
            'dark-pink',
            'gray-pink',
            'light-green',
            'dark-green',
            'gray-green'
          ]}
          enableSystem
          defaultTheme="dark"
        >
          <BaseErrorBoundary>
            <HashRouter>
              <App />
            </HashRouter>
          </BaseErrorBoundary>
        </NextThemesProvider>
      </NextUIProvider>
    </React.StrictMode>
  )
})
