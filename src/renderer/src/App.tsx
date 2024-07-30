import { Switch } from '@nextui-org/switch'
import { useTheme } from 'next-themes'
import { useEffect } from 'react'

function App(): JSX.Element {
  const { setTheme } = useTheme()

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

  return <Switch />
}

export default App
