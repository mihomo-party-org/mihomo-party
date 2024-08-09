import { Button, Input, Switch, Tab, Tabs } from '@nextui-org/react'
import BasePage from '@renderer/components/base/base-page'
import SettingCard from '@renderer/components/base/base-setting-card'
import SettingItem from '@renderer/components/base/base-setting-item'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import {
  checkAutoRun,
  enableAutoRun,
  disableAutoRun,
  quitApp,
  checkUpdate
} from '@renderer/utils/ipc'
import { IoLogoGithub } from 'react-icons/io5'
import { version } from '@renderer/utils/init'
import useSWR from 'swr'
import { useState } from 'react'
import debounce from '@renderer/utils/debounce'
import { useTheme } from 'next-themes'

const Settings: React.FC = () => {
  const { setTheme } = useTheme()
  const { data: enable, mutate } = useSWR('checkAutoRun', checkAutoRun, {
    errorRetryCount: 5,
    errorRetryInterval: 200
  })
  const { appConfig, patchAppConfig } = useAppConfig()
  const {
    silentStart = false,
    delayTestUrl,
    delayTestTimeout,
    autoCheckUpdate,
    userAgent,
    appTheme = 'system'
  } = appConfig || {}
  const [url, setUrl] = useState(delayTestUrl)
  const [ua, setUa] = useState(userAgent)

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
        <SettingItem title="自动检查更新" divider>
          <Switch
            size="sm"
            isSelected={autoCheckUpdate}
            onValueChange={(v) => {
              patchAppConfig({ autoCheckUpdate: v })
            }}
          />
        </SettingItem>
        <SettingItem title="静默启动" divider>
          <Switch
            size="sm"
            isSelected={silentStart}
            onValueChange={(v) => {
              patchAppConfig({ silentStart: v })
            }}
          />
        </SettingItem>
        <SettingItem title="应用主题">
          <Tabs
            size="sm"
            color="primary"
            selectedKey={appTheme}
            onSelectionChange={(key) => {
              console.log(key)
              setTheme(key as AppTheme)

              patchAppConfig({ appTheme: key as AppTheme })
            }}
          >
            <Tab key="system" title="自动" />
            <Tab key="dark" title="深色" />
            <Tab key="gray" title="灰色" />
            <Tab key="pink" title="粉色" />
            <Tab key="light" title="浅色" />
          </Tabs>
        </SettingItem>
      </SettingCard>
      <SettingCard>
        <SettingItem title="订阅拉取 UA" divider>
          <Input
            size="sm"
            className="w-[60%]"
            value={ua}
            placeholder="默认 clash-meta"
            onValueChange={(v) => {
              setUa(v)
              debounce(() => {
                patchAppConfig({ userAgent: v })
              }, 2000)
            }}
          ></Input>
        </SettingItem>
        <SettingItem title="延迟测试地址" divider>
          <Input
            size="sm"
            className="w-[60%]"
            value={url}
            placeholder="默认https://www.gstatic.com/generate_204"
            onValueChange={(v) => {
              setUrl(v)
              debounce(() => {
                patchAppConfig({ delayTestUrl: v })
              }, 2000)
            }}
          ></Input>
        </SettingItem>
        <SettingItem title="延迟测试超时时间">
          <Input
            type="number"
            size="sm"
            className="w-[60%]"
            value={delayTestTimeout?.toString()}
            placeholder="默认5000"
            onValueChange={(v) => {
              patchAppConfig({ delayTestTimeout: parseInt(v) })
            }}
          ></Input>
        </SettingItem>
      </SettingCard>
      <SettingCard>
        <SettingItem title="检查更新" divider>
          <Button
            size="sm"
            onPress={() => {
              checkUpdate().then((v) => {
                if (v) {
                  new window.Notification(`v${v}版本已发布`, { body: '点击前往下载' }).onclick =
                    (): void => {
                      open(`https://github.com/pompurin404/mihomo-party/releases/tag/v${v}`)
                    }
                } else {
                  new window.Notification('当前已是最新版本', { body: '无需更新' })
                }
              })
            }}
          >
            检查更新
          </Button>
        </SettingItem>
        <SettingItem title="退出应用" divider>
          <Button size="sm" onPress={quitApp}>
            退出应用
          </Button>
        </SettingItem>
        <SettingItem title="应用版本">
          <div className="select-none">v{version}</div>
        </SettingItem>
      </SettingCard>
    </BasePage>
  )
}

export default Settings
