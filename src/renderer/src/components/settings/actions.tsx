import { Button, Tooltip } from '@nextui-org/react'
import SettingCard from '../base/base-setting-card'
import SettingItem from '../base/base-setting-item'
import {
  checkUpdate,
  createHeapSnapshot,
  quitApp,
  quitWithoutCore,
  resetAppConfig
} from '@renderer/utils/ipc'
import { useState } from 'react'
import UpdaterModal from '../updater/updater-modal'
import { version } from '@renderer/utils/init'
import { IoIosHelpCircle } from 'react-icons/io'
import { firstDriver } from '@renderer/App'

const Actions: React.FC = () => {
  const [newVersion, setNewVersion] = useState('')
  const [changelog, setChangelog] = useState('')
  const [openUpdate, setOpenUpdate] = useState(false)
  const [checkingUpdate, setCheckingUpdate] = useState(false)

  return (
    <>
      {openUpdate && (
        <UpdaterModal
          onClose={() => setOpenUpdate(false)}
          version={newVersion}
          changelog={changelog}
        />
      )}
      <SettingCard>
        <SettingItem title="打开引导页面" divider>
          <Button size="sm" onPress={() => firstDriver.drive()}>
            打开引导页面
          </Button>
        </SettingItem>
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
        <SettingItem
          title="重置软件"
          actions={
            <Tooltip content="删除所有配置，将软件恢复初始状态">
              <Button isIconOnly size="sm" variant="light">
                <IoIosHelpCircle className="text-lg" />
              </Button>
            </Tooltip>
          }
          divider
        >
          <Button size="sm" onPress={resetAppConfig}>
            重置软件
          </Button>
        </SettingItem>
        <SettingItem
          title="创建堆快照"
          actions={
            <Tooltip content="创建主进程堆快照，用于排查内存问题">
              <Button isIconOnly size="sm" variant="light">
                <IoIosHelpCircle className="text-lg" />
              </Button>
            </Tooltip>
          }
          divider
        >
          <Button size="sm" onPress={createHeapSnapshot}>
            创建堆快照
          </Button>
        </SettingItem>
        <SettingItem
          title="轻量模式"
          actions={
            <Tooltip content="完全退出软件，只保留内核进程">
              <Button isIconOnly size="sm" variant="light">
                <IoIosHelpCircle className="text-lg" />
              </Button>
            </Tooltip>
          }
          divider
        >
          <Button size="sm" onPress={quitWithoutCore}>
            轻量模式
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
    </>
  )
}

export default Actions
