import { Button } from '@nextui-org/react'
import SettingCard from '../base/base-setting-card'
import SettingItem from '../base/base-setting-item'
import { checkUpdate, quitApp } from '@renderer/utils/ipc'
import { useState } from 'react'
import UpdaterModal from '../updater/updater-modal'
import { version } from '@renderer/utils/init'

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
    </>
  )
}

export default Actions
