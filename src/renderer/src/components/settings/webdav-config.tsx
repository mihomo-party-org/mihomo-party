import React, { useState } from 'react'
import SettingCard from '../base/base-setting-card'
import SettingItem from '../base/base-setting-item'
import { Button, Input } from '@nextui-org/react'
import { listWebdavBackups, webdavBackup } from '@renderer/utils/ipc'
import WebdavRestoreModal from './webdav-restore-modal'
import debounce from '@renderer/utils/debounce'
import { useAppConfig } from '@renderer/hooks/use-app-config'

const WebdavConfig: React.FC = () => {
  const { appConfig, patchAppConfig } = useAppConfig()
  const { webdavUrl, webdavUsername, webdavPassword } = appConfig || {}
  const [backuping, setBackuping] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [filenames, setFilenames] = useState<string[]>([])
  const [restoreOpen, setRestoreOpen] = useState(false)

  const [webdav, setWebdav] = useState({ webdavUrl, webdavUsername, webdavPassword })
  const setWebdavDebounce = debounce(({ webdavUrl, webdavUsername, webdavPassword }) => {
    patchAppConfig({ webdavUrl, webdavUsername, webdavPassword })
  }, 500)
  const handleBackup = async (): Promise<void> => {
    setBackuping(true)
    try {
      await webdavBackup()
      new window.Notification('备份成功', { body: '备份文件已上传至 WebDav' })
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
      setFilenames(filenames)
      setRestoreOpen(true)
    } catch (e) {
      alert(`获取备份列表失败: ${e}`)
    } finally {
      setRestoring(false)
    }
  }
  return (
    <>
      {restoreOpen && (
        <WebdavRestoreModal filenames={filenames} onClose={() => setRestoreOpen(false)} />
      )}
      <SettingCard>
        <SettingItem title="WebDav 地址" divider>
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
        <SettingItem title="WebDav 用户名" divider>
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
        <SettingItem title="WebDav 密码" divider>
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
          <Button isLoading={backuping} fullWidth size="sm" className="mr-1" onPress={handleBackup}>
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
    </>
  )
}

export default WebdavConfig
