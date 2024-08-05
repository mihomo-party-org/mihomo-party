import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { NextUIProvider } from '@nextui-org/react'
import { init } from '@renderer/utils/init'
import '@renderer/assets/main.css'
import App from '@renderer/App'

init().then(() => {
  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <NextUIProvider>
        <NextThemesProvider attribute="class" defaultTheme="dark">
          <HashRouter>
            <App />
          </HashRouter>
        </NextThemesProvider>
      </NextUIProvider>
    </React.StrictMode>
  )
})
