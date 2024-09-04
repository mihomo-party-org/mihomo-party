import React, { Key, useState } from 'react'
import SettingCard from '../base/base-setting-card'
import SettingItem from '../base/base-setting-item'
import { Button, Input, Select, SelectItem, Switch, Tab, Tabs } from '@nextui-org/react'
import { BiCopy } from 'react-icons/bi'
import useSWR from 'swr'
import {
  checkAutoRun,
  copyEnv,
  disableAutoRun,
  enableAutoRun,
  relaunchApp,
  restartCore,
  startSubStoreServer
} from '@renderer/utils/ipc'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { platform } from '@renderer/utils/init'
import { useTheme } from 'next-themes'
import debounce from '@renderer/utils/debounce'

const GeneralConfig: React.FC = () => {
  const { data: enable, mutate: mutateEnable } = useSWR('checkAutoRun', checkAutoRun)
  const { appConfig, patchAppConfig } = useAppConfig()
  const { setTheme } = useTheme()
  const {
    silentStart = false,
    useDockIcon = true,
    showTraffic = true,
    proxyInTray = true,
    useWindowFrame = false,
    useSubStore = true,
    useCustomSubStore = false,
    customSubStoreUrl,
    envType = platform === 'win32' ? 'powershell' : 'bash',
    autoCheckUpdate,
    appTheme = 'system'
  } = appConfig || {}

  const [subStoreUrl, setSubStoreUrl] = useState(customSubStoreUrl)
  const setSubStoreUrlDebounce = debounce((v: string) => {
    patchAppConfig({ customSubStoreUrl: v })
  }, 500)
  const onThemeChange = (key: Key, type: 'theme' | 'color'): void => {
    const [theme, color] = appTheme.split('-')

    if (type === 'theme') {
      let themeStr = key.toString()
      if (key !== 'system') {
        if (color) {
          themeStr += `-${color}`
        }
      }
      setTheme(themeStr)
      patchAppConfig({ appTheme: themeStr as AppTheme })
    } else {
      let themeStr = theme
      if (theme !== 'system') {
        if (key !== 'blue') {
          themeStr += `-${key}`
        }
        setTheme(themeStr)
        patchAppConfig({ appTheme: themeStr as AppTheme })
      }
    }
  }

  return (
    <SettingCard>
      <SettingItem title="开机自启" divider>
        <Switch
          size="sm"
          isSelected={enable}
          onValueChange={async (v) => {
            try {
              if (v) {
                await enableAutoRun()
              } else {
                await disableAutoRun()
              }
            } catch (e) {
              alert(e)
            } finally {
              mutateEnable()
            }
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
      <SettingItem
        title="复制环境变量类型"
        actions={
          <Button isIconOnly size="sm" className="ml-2" variant="light" onPress={copyEnv}>
            <BiCopy className="text-lg" />
          </Button>
        }
        divider
      >
        <Select
          className="w-[150px]"
          size="sm"
          selectedKeys={new Set([envType])}
          onSelectionChange={async (v) => {
            try {
              await patchAppConfig({ envType: v.currentKey as 'bash' | 'cmd' | 'powershell' })
            } catch (e) {
              alert(e)
            }
          }}
        >
          <SelectItem key="bash">Bash</SelectItem>
          <SelectItem key="cmd">CMD</SelectItem>
          <SelectItem key="powershell">PowerShell</SelectItem>
        </Select>
      </SettingItem>
      {platform !== 'linux' && (
        <SettingItem title="托盘菜单显示节点信息" divider>
          <Switch
            size="sm"
            isSelected={proxyInTray}
            onValueChange={async (v) => {
              await patchAppConfig({ proxyInTray: v })
            }}
          />
        </SettingItem>
      )}
      {platform === 'darwin' && (
        <>
          <SettingItem title="显示Dock图标" divider>
            <Switch
              size="sm"
              isSelected={useDockIcon}
              onValueChange={async (v) => {
                await patchAppConfig({ useDockIcon: v })
              }}
            />
          </SettingItem>
          <SettingItem title="显示网速信息" divider>
            <Switch
              size="sm"
              isSelected={showTraffic}
              onValueChange={async (v) => {
                await patchAppConfig({ showTraffic: v })
                await restartCore()
              }}
            />
          </SettingItem>
        </>
      )}
      <SettingItem title="启用Sub-Store" divider>
        <Switch
          size="sm"
          isSelected={useSubStore}
          onValueChange={async (v) => {
            try {
              await patchAppConfig({ useSubStore: v })
              if (v) await startSubStoreServer()
            } catch (e) {
              alert(e)
            }
          }}
        />
      </SettingItem>
      {useSubStore && (
        <SettingItem title="使用自建Sub-Store后端" divider>
          <Switch
            size="sm"
            isSelected={useCustomSubStore}
            onValueChange={async (v) => {
              try {
                await patchAppConfig({ useCustomSubStore: v })
                if (!v) await startSubStoreServer()
              } catch (e) {
                alert(e)
              }
            }}
          />
        </SettingItem>
      )}
      {useCustomSubStore && (
        <SettingItem title="自建Sub-Store后端地址" divider>
          <Input
            size="sm"
            className="w-[60%]"
            value={subStoreUrl}
            placeholder="必须包含协议头"
            onValueChange={(v: string) => {
              setSubStoreUrl(v)
              setSubStoreUrlDebounce(v)
            }}
          />
        </SettingItem>
      )}
      <SettingItem title="使用系统标题栏" divider>
        <Switch
          size="sm"
          isSelected={useWindowFrame}
          onValueChange={async (v) => {
            await patchAppConfig({ useWindowFrame: v })
            await relaunchApp()
          }}
        />
      </SettingItem>
      <SettingItem title="背景色" divider={appTheme !== 'system'}>
        <Tabs
          size="sm"
          color="primary"
          selectedKey={appTheme.split('-')[0]}
          onSelectionChange={(key) => {
            onThemeChange(key, 'theme')
          }}
        >
          <Tab key="system" title="自动" />
          <Tab key="dark" title="深色" />
          <Tab key="gray" title="灰色" />
          <Tab key="light" title="浅色" />
        </Tabs>
      </SettingItem>
      {appTheme !== 'system' && (
        <SettingItem title="主题色">
          <Tabs
            size="sm"
            color="primary"
            selectedKey={appTheme.split('-')[1] || 'blue'}
            onSelectionChange={(key) => {
              onThemeChange(key, 'color')
            }}
          >
            <Tab key="blue" title="蓝色" />
            <Tab key="pink" title="粉色" />
            <Tab key="green" title="绿色" />
          </Tabs>
        </SettingItem>
      )}
    </SettingCard>
  )
}

export default GeneralConfig
