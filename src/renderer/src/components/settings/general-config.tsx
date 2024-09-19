import React, { Key, useState } from 'react'
import SettingCard from '../base/base-setting-card'
import SettingItem from '../base/base-setting-item'
import { Button, Input, Select, SelectItem, Switch, Tab, Tabs, Tooltip } from '@nextui-org/react'
import { BiCopy } from 'react-icons/bi'
import useSWR from 'swr'
import {
  checkAutoRun,
  copyEnv,
  disableAutoRun,
  enableAutoRun,
  relaunchApp,
  restartCore
} from '@renderer/utils/ipc'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { platform } from '@renderer/utils/init'
import { useTheme } from 'next-themes'
import { IoIosHelpCircle } from 'react-icons/io'
import CSSEditorModal from './css-editor-modal'

const GeneralConfig: React.FC = () => {
  const { data: enable, mutate: mutateEnable } = useSWR('checkAutoRun', checkAutoRun)
  const { appConfig, patchAppConfig } = useAppConfig()
  const [openCSSEditor, setOpenCSSEditor] = useState(false)
  const { setTheme } = useTheme()
  const {
    silentStart = false,
    useDockIcon = true,
    showTraffic = true,
    proxyInTray = true,
    useWindowFrame = false,
    autoQuitWithoutCore = false,
    autoQuitWithoutCoreDelay = 60,
    injectCSS = DEFAULT_CSS,
    envType = platform === 'win32' ? 'powershell' : 'bash',
    autoCheckUpdate,
    appTheme = 'system'
  } = appConfig || {}

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
    <>
      {openCSSEditor && (
        <CSSEditorModal
          css={injectCSS}
          onCancel={() => setOpenCSSEditor(false)}
          onConfirm={async (css: string) => {
            await patchAppConfig({ injectCSS: css })
            setOpenCSSEditor(false)
          }}
        />
      )}
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
          title="自动开启轻量模式"
          actions={
            <Tooltip content="关闭窗口指定时间后自动进入轻量模式">
              <Button isIconOnly size="sm" variant="light">
                <IoIosHelpCircle className="text-lg" />
              </Button>
            </Tooltip>
          }
          divider
        >
          <Switch
            size="sm"
            isSelected={autoQuitWithoutCore}
            onValueChange={(v) => {
              patchAppConfig({ autoQuitWithoutCore: v })
            }}
          />
        </SettingItem>
        {autoQuitWithoutCore && (
          <SettingItem title="自动开启轻量模式延时" divider>
            <Input
              size="sm"
              className="w-[100px]"
              type="number"
              endContent="秒"
              value={autoQuitWithoutCoreDelay.toString()}
              onValueChange={async (v: string) => {
                let num = parseInt(v)
                if (isNaN(num)) num = 5
                if (num < 5) num = 5
                await patchAppConfig({ autoQuitWithoutCoreDelay: num })
              }}
            />
          </SettingItem>
        )}
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
            <SettingItem title="显示 Dock 图标" divider>
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
        <SettingItem title="自定义样式" divider>
          <Button size="sm" onPress={() => setOpenCSSEditor(true)} variant="bordered">
            编辑 CSS 样式
          </Button>
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
    </>
  )
}

const DEFAULT_CSS = `/* 使用 !important 以覆盖默认样式 */
/* --nextui-xxx 变量只支持hsl色值 */
/* 若要对所有主题生效，可直接给html元素设置样式 */

/* 深色-蓝色 */
.dark, [data-theme="dark"] {
    --nextui-background: 0 0% 0%;
    --nextui-foreground-50: 240 5.88% 10%;
    --nextui-foreground-100: 240 3.7% 15.88%;
    --nextui-foreground-200: 240 5.26% 26.08%;
    --nextui-foreground-300: 240 5.2% 33.92%;
    --nextui-foreground-400: 240 3.83% 46.08%;
    --nextui-foreground-500: 240 5.03% 64.9%;
    --nextui-foreground-600: 240 4.88% 83.92%;
    --nextui-foreground-700: 240 5.88% 90%;
    --nextui-foreground-800: 240 4.76% 95.88%;
    --nextui-foreground-900: 0 0% 98.04%;
    --nextui-foreground: 210 5.56% 92.94%;
    --nextui-focus: 212.01999999999998 100% 46.67%;
    --nextui-overlay: 0 0% 0%;
    --nextui-divider: 0 0% 100%;
    --nextui-divider-opacity: 0.15;
    --nextui-content1: 240 5.88% 10%;
    --nextui-content1-foreground: 0 0% 98.04%;
    --nextui-content2: 240 3.7% 15.88%;
    --nextui-content2-foreground: 240 4.76% 95.88%;
    --nextui-content3: 240 5.26% 26.08%;
    --nextui-content3-foreground: 240 5.88% 90%;
    --nextui-content4: 240 5.2% 33.92%;
    --nextui-content4-foreground: 240 4.88% 83.92%;
    --nextui-default-50: 240 5.88% 10%;
    --nextui-default-100: 240 3.7% 15.88%;
    --nextui-default-200: 240 5.26% 26.08%;
    --nextui-default-300: 240 5.2% 33.92%;
    --nextui-default-400: 240 3.83% 46.08%;
    --nextui-default-500: 240 5.03% 64.9%;
    --nextui-default-600: 240 4.88% 83.92%;
    --nextui-default-700: 240 5.88% 90%;
    --nextui-default-800: 240 4.76% 95.88%;
    --nextui-default-900: 0 0% 98.04%;
    --nextui-default-foreground: 0 0% 100%;
    --nextui-default: 240 5.26% 26.08%;
    --nextui-primary-50: 211.84000000000003 100% 9.61%;
    --nextui-primary-100: 211.84000000000003 100% 19.22%;
    --nextui-primary-200: 212.24 100% 28.82%;
    --nextui-primary-300: 212.14 100% 38.43%;
    --nextui-primary-400: 212.01999999999998 100% 46.67%;
    --nextui-primary-500: 212.14 92.45% 58.43%;
    --nextui-primary-600: 212.24 92.45% 68.82%;
    --nextui-primary-700: 211.84000000000003 92.45% 79.22%;
    --nextui-primary-800: 211.84000000000003 92.45% 89.61%;
    --nextui-primary-900: 212.5 92.31% 94.9%;
    --nextui-primary: 212.01999999999998 100% 46.67%;
    --nextui-primary-foreground: 0 0% 100%;
    --nextui-secondary-50: 270 66.67% 9.41%;
    --nextui-secondary-100: 270 66.67% 18.82%;
    --nextui-secondary-200: 270 66.67% 28.24%;
    --nextui-secondary-300: 270 66.67% 37.65%;
    --nextui-secondary-400: 270 66.67% 47.06%;
    --nextui-secondary-500: 270 59.26% 57.65%;
    --nextui-secondary-600: 270 59.26% 68.24%;
    --nextui-secondary-700: 270 59.26% 78.82%;
    --nextui-secondary-800: 270 59.26% 89.41%;
    --nextui-secondary-900: 270 61.54% 94.9%;
    --nextui-secondary-foreground: 0 0% 100%;
    --nextui-secondary: 270 59.26% 57.65%;
    --nextui-success-50: 145.71000000000004 77.78% 8.82%;
    --nextui-success-100: 146.2 79.78% 17.45%;
    --nextui-success-200: 145.78999999999996 79.26% 26.47%;
    --nextui-success-300: 146.01 79.89% 35.1%;
    --nextui-success-400: 145.96000000000004 79.46% 43.92%;
    --nextui-success-500: 146.01 62.45% 55.1%;
    --nextui-success-600: 145.78999999999996 62.57% 66.47%;
    --nextui-success-700: 146.2 61.74% 77.45%;
    --nextui-success-800: 145.71000000000004 61.4% 88.82%;
    --nextui-success-900: 146.66999999999996 64.29% 94.51%;
    --nextui-success-foreground: 0 0% 0%;
    --nextui-success: 145.96000000000004 79.46% 43.92%;
    --nextui-warning-50: 37.139999999999986 75% 10.98%;
    --nextui-warning-100: 37.139999999999986 75% 21.96%;
    --nextui-warning-200: 36.95999999999998 73.96% 33.14%;
    --nextui-warning-300: 37.00999999999999 74.22% 44.12%;
    --nextui-warning-400: 37.02999999999997 91.27% 55.1%;
    --nextui-warning-500: 37.00999999999999 91.26% 64.12%;
    --nextui-warning-600: 36.95999999999998 91.24% 73.14%;
    --nextui-warning-700: 37.139999999999986 91.3% 81.96%;
    --nextui-warning-800: 37.139999999999986 91.3% 90.98%;
    --nextui-warning-900: 54.55000000000001 91.67% 95.29%;
    --nextui-warning-foreground: 0 0% 0%;
    --nextui-warning: 37.02999999999997 91.27% 55.1%;
    --nextui-danger-50: 340 84.91% 10.39%;
    --nextui-danger-100: 339.3299999999999 86.54% 20.39%;
    --nextui-danger-200: 339.11 85.99% 30.78%;
    --nextui-danger-300: 339 86.54% 40.78%;
    --nextui-danger-400: 339.20000000000005 90.36% 51.18%;
    --nextui-danger-500: 339 90% 60.78%;
    --nextui-danger-600: 339.11 90.6% 70.78%;
    --nextui-danger-700: 339.3299999999999 90% 80.39%;
    --nextui-danger-800: 340 91.84% 90.39%;
    --nextui-danger-900: 339.13 92% 95.1%;
    --nextui-danger-foreground: 0 0% 100%;
    --nextui-danger: 339.20000000000005 90.36% 51.18%;
    --nextui-divider-weight: 1px;
    --nextui-disabled-opacity: .5;
    --nextui-font-size-tiny: 0.75rem;
    --nextui-font-size-small: 0.875rem;
    --nextui-font-size-medium: 1rem;
    --nextui-font-size-large: 1.125rem;
    --nextui-line-height-tiny: 1rem;
    --nextui-line-height-small: 1.25rem;
    --nextui-line-height-medium: 1.5rem;
    --nextui-line-height-large: 1.75rem;
    --nextui-radius-small: 8px;
    --nextui-radius-medium: 12px;
    --nextui-radius-large: 14px;
    --nextui-border-width-small: 1px;
    --nextui-border-width-medium: 2px;
    --nextui-border-width-large: 3px;
    --nextui-box-shadow-small: 0px 0px 5px 0px rgb(0 0 0 / 0.05), 0px 2px 10px 0px rgb(0 0 0 / 0.2), inset 0px 0px 1px 0px rgb(255 255 255 / 0.15);
    --nextui-box-shadow-medium: 0px 0px 15px 0px rgb(0 0 0 / 0.06), 0px 2px 30px 0px rgb(0 0 0 / 0.22), inset 0px 0px 1px 0px rgb(255 255 255 / 0.15);
    --nextui-box-shadow-large: 0px 0px 30px 0px rgb(0 0 0 / 0.07), 0px 30px 60px 0px rgb(0 0 0 / 0.26), inset 0px 0px 1px 0px rgb(255 255 255 / 0.15);
    --nextui-hover-opacity: .9;
}
/* 灰色-蓝色 */
.gray, [data-theme="gray"] {
}
/* 浅色-蓝色 */
.light, [data-theme="light"] {
}
/* 深色-粉色 */
.dark-pink, [data-theme="dark-pink"] {
}
/* 灰色-粉色 */
.gray-pink, [data-theme="gray-pink"] {
}
/* 浅色-粉色 */
.light-pink, [data-theme="light-pink"] {
}
/* 深色-绿色 */
.dark-green, [data-theme="dark-green"] {
}
/* 灰色-绿色 */
.gray-green, [data-theme="gray-green"] {
}
/* 浅色-绿色 */
.light-green, [data-theme="light-green"] {
}
`
export default GeneralConfig
