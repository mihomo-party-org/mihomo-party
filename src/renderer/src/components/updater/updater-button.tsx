import { Button } from '@nextui-org/react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { checkUpdate } from '@renderer/utils/ipc'
import React from 'react'
import useSWR from 'swr'

const UpdaterButton: React.FC = () => {
  const { appConfig } = useAppConfig()
  const { autoCheckUpdate } = appConfig || {}

  const { data: version } = useSWR(
    autoCheckUpdate ? 'checkUpdate' : undefined,
    autoCheckUpdate ? checkUpdate : (): void => {},
    {
      refreshInterval: 1000 * 60 * 10
    }
  )
  if (!version) return null

  return (
    <Button
      color="danger"
      size="sm"
      onPress={() => {
        open(`https://github.com/pompurin404/mihomo-party/releases/tag/v${version}`)
      }}
    >
      v{version}
    </Button>
  )
}

export default UpdaterButton
