import { Button, Input, Select, SelectItem, Switch, Tab, Tabs } from '@nextui-org/react'
import BasePage from '@renderer/components/base/base-page'
import SettingCard from '@renderer/components/base/base-setting-card'
import SettingItem from '@renderer/components/base/base-setting-item'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import UpdaterModal from '@renderer/components/updater/updater-modal'
import {
  checkAutoRun,
  enableAutoRun,
  disableAutoRun,
  quitApp,
  checkUpdate,
  patchControledMihomoConfig,
  isPortable,
  setPortable,
  restartCore,
  webdavBackup,
  listWebdavBackups
} from '@renderer/utils/ipc'
import { CgWebsite } from 'react-icons/cg'
import { IoLogoGithub } from 'react-icons/io5'
import { platform, version } from '@renderer/utils/init'
import useSWR from 'swr'
import { Key, useState } from 'react'
import debounce from '@renderer/utils/debounce'
import { useTheme } from 'next-themes'
import WebdavRestoreModal from '@renderer/components/settings/webdav-restore-modal'

const Settings: React.FC = () => {
  const { setTheme } = useTheme()
  const { data: enable, mutate: mutateEnable } = useSWR('checkAutoRun', checkAutoRun)
  const { data: portable, mutate: mutatePortable } = useSWR('isPortable', isPortable)
  const { appConfig, patchAppConfig } = useAppConfig()
  const {
    silentStart = false,
    controlDns = true,
    controlSniff = true,
    useDockIcon = true,
    showTraffic = true,
    delayTestUrl,
    delayTestTimeout,
    autoCheckUpdate,
    userAgent,
    autoCloseConnection = true,
    appTheme = 'system',
    webdavUrl,
    webdavUsername,
    webdavPassword
  } = appConfig || {}
  const [newVersion, setNewVersion] = useState('')
  const [changelog, setChangelog] = useState('')
  const [openUpdate, setOpenUpdate] = useState(false)
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [backuping, setBackuping] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [filenames, setFilenames] = useState<string[]>([])
  const [restoreOpen, setRestoreOpen] = useState(false)
  const [url, setUrl] = useState(delayTestUrl)
  const setUrlDebounce = debounce((v: string) => {
    patchAppConfig({ delayTestUrl: v })
  }, 500)
  const [ua, setUa] = useState(userAgent)
  const setUaDebounce = debounce((v: string) => {
    patchAppConfig({ userAgent: v })
  }, 500)
  const [webdav, setWebdav] = useState({ webdavUrl, webdavUsername, webdavPassword })
  const setWebdavDebounce = debounce(({ webdavUrl, webdavUsername, webdavPassword }) => {
    patchAppConfig({ webdavUrl, webdavUsername, webdavPassword })
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

  const handleBackup = async (): Promise<void> => {
    setBackuping(true)
    try {
      await webdavBackup()
      new window.Notification('备份成功', { body: '备份文件已上传至WebDav' })
    } catch (e) {
      alert(e)
    } finally {
      setBackuping(false)
    }
  }

  const handleRestore = async (): Promise<void> => {
    try {
      setRestoring(true)
      const filenames = await listWebdavBackups()
      setRestoring(false)
      setFilenames(filenames)
      setRestoreOpen(true)
    } catch (e) {
      alert(`获取备份列表失败: ${e}`)
    }
  }

  return (
    <>
      {restoreOpen && (
        <WebdavRestoreModal filenames={filenames} onClose={() => setRestoreOpen(false)} />
      )}
      {openUpdate && (
        <UpdaterModal
          onClose={() => setOpenUpdate(false)}
          version={newVersion}
          changelog={changelog}
        />
      )}

      <BasePage
        title="应用设置"
        header={
          <>
            <Button
              isIconOnly
              size="sm"
              title="官方文档"
              className="mr-2"
              onPress={() => {
                window.open('https://mihomo.party')
              }}
            >
              <CgWebsite className="text-lg" />
            </Button>
            <Button
              isIconOnly
              size="sm"
              title="GitHub仓库"
              onPress={() => {
                window.open('https://github.com/pompurin404/mihomo-party')
              }}
            >
              <IoLogoGithub className="text-lg" />
            </Button>
          </>
        }
      >
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
          {platform === 'win32' && (
            <SettingItem title="数据存储路径" divider>
              <Select
                className="w-[150px]"
                size="sm"
                selectedKeys={new Set([portable ? 'portable' : 'data'])}
                onSelectionChange={async (v) => {
                  try {
                    await setPortable(v.currentKey === 'portable')
                  } catch (e) {
                    alert(e)
                  } finally {
                    mutatePortable()
                  }
                }}
              >
                <SelectItem key="data">AppData</SelectItem>
                <SelectItem key="portable">安装目录</SelectItem>
              </Select>
            </SettingItem>
          )}
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
        <SettingCard>
          <SettingItem title="WebDav地址" divider>
            <Input
              size="sm"
              className="w-[60%]"
              value={webdav.webdavUrl}
              onValueChange={(v) => {
                setWebdav({ ...webdav, webdavUrl: v })
                setWebdavDebounce({ ...webdav, webdavUrl: v })
              }}
            />
          </SettingItem>
          <SettingItem title="WebDav用户名" divider>
            <Input
              size="sm"
              className="w-[60%]"
              value={webdav.webdavUsername}
              onValueChange={(v) => {
                setWebdav({ ...webdav, webdavUsername: v })
                setWebdavDebounce({ ...webdav, webdavUsername: v })
              }}
            />
          </SettingItem>
          <SettingItem title="WebDav密码" divider>
            <Input
              size="sm"
              className="w-[60%]"
              type="password"
              value={webdav.webdavPassword}
              onValueChange={(v) => {
                setWebdav({ ...webdav, webdavPassword: v })
                setWebdavDebounce({ ...webdav, webdavPassword: v })
              }}
            />
          </SettingItem>
          <div className="flex justify0between">
            <Button
              isLoading={backuping}
              fullWidth
              size="sm"
              className="mr-1"
              onPress={handleBackup}
            >
              备份
            </Button>
            <Button
              isLoading={restoring}
              fullWidth
              size="sm"
              className="ml-1"
              onPress={handleRestore}
            >
              恢复
            </Button>
          </div>
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
                setUaDebounce(v)
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
                setUrlDebounce(v)
              }}
            ></Input>
          </SettingItem>
          <SettingItem title="延迟测试超时时间" divider>
            <Input
              type="number"
              size="sm"
              className="w-[60%]"
              value={delayTestTimeout?.toString()}
              placeholder="默认5000"
              onValueChange={(v) => {
                patchAppConfig({ delayTestTimeout: parseInt(v) })
              }}
            />
          </SettingItem>
          <SettingItem title="接管DNS设置" divider>
            <Switch
              size="sm"
              isSelected={controlDns}
              onValueChange={async (v) => {
                await patchAppConfig({ controlDns: v })
                await patchControledMihomoConfig({})
              }}
            />
          </SettingItem>
          <SettingItem title="接管域名嗅探设置" divider>
            <Switch
              size="sm"
              isSelected={controlSniff}
              onValueChange={async (v) => {
                await patchAppConfig({ controlSniff: v })
                await patchControledMihomoConfig({})
              }}
            />
          </SettingItem>
          <SettingItem title="自动断开连接">
            <Switch
              size="sm"
              isSelected={autoCloseConnection}
              onValueChange={(v) => {
                patchAppConfig({ autoCloseConnection: v })
              }}
            />
          </SettingItem>
        </SettingCard>
        <SettingCard>
          <SettingItem title="检查更新" divider>
            <Button
              size="sm"
              isLoading={checkingUpdate}
              onPress={async () => {
                try {
                  setCheckingUpdate(true)
                  const version = await checkUpdate()
                  if (version) {
                    setNewVersion(version.version)
                    setChangelog(version.changelog)
                    setOpenUpdate(true)
                  } else {
                    new window.Notification('当前已是最新版本', { body: '无需更新' })
                  }
                } catch (e) {
                  alert(e)
                } finally {
                  setCheckingUpdate(false)
                }
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
            <div>v{version}</div>
          </SettingItem>
        </SettingCard>
      </BasePage>
    </>
  )
}

export default Settings
