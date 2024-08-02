import { Button, Switch } from '@nextui-org/react'
import BasePage from '@renderer/components/base/base-page'
import SettingCard from '@renderer/components/base/base-setting-card'
import SettingItem from '@renderer/components/base/base-setting-item'
import { useAppConfig } from '@renderer/hooks/use-config'
import { checkAutoRun, enableAutoRun, disableAutoRun } from '@renderer/utils/ipc'
import { IoLogoGithub } from 'react-icons/io5'

import useSWR from 'swr'

const Settings: React.FC = () => {
  const { data: enable, mutate } = useSWR('checkAutoRun', checkAutoRun, {
    errorRetryCount: 5,
    errorRetryInterval: 200
  })

  const { appConfig, patchAppConfig } = useAppConfig()
  const { silentStart = false } = appConfig || {}

  return (
    <BasePage
      title="应用设置"
      header={
        <Button
          isIconOnly
          size="sm"
          onPress={() => {
            window.open('https://github.com/pompurin404/mihomo-party')
          }}
        >
          <IoLogoGithub className="text-lg" />
        </Button>
      }
    >
      <SettingCard>
        <SettingItem title="开机自启" divider>
          <Switch
            size="sm"
            isSelected={enable}
            onValueChange={(v) => {
              if (v) {
                enableAutoRun()
              } else {
                disableAutoRun()
              }
              mutate()
            }}
          />
        </SettingItem>
        <SettingItem title="静默启动">
          <Switch
            size="sm"
            isSelected={silentStart}
            onValueChange={(v) => {
              patchAppConfig({ silentStart: v })
            }}
          />
        </SettingItem>
      </SettingCard>
    </BasePage>
  )
}

export default Settings
