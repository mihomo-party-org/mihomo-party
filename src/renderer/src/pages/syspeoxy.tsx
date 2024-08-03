import { Button, Input, Tab, Tabs } from '@nextui-org/react'
import BasePage from '@renderer/components/base/base-page'
import SettingCard from '@renderer/components/base/base-setting-card'
import SettingItem from '@renderer/components/base/base-setting-item'
import PacEditorViewer from '@renderer/components/sysproxy/pac-editor-modal'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { triggerSysProxy } from '@renderer/utils/ipc'
import { Key, useState } from 'react'
import React from 'react'

const defaultPacScript = `
function FindProxyForURL(url, host) {
  return "PROXY 127.0.0.1:%mixed-port%; SOCKS5 127.0.0.1:%mixed-port%; DIRECT;";
}
`

const Sysproxy: React.FC = () => {
  const { appConfig, patchAppConfig } = useAppConfig()
  const { sysProxy } = appConfig || { sysProxy: { enable: false } }

  const [values, setValues] = useState<ISysProxyConfig>(sysProxy)
  const [openPacEditor, setOpenPacEditor] = useState(false)
  const onSave = async (): Promise<void> => {
    // check valid TODO
    await patchAppConfig({ sysProxy: values })
    try {
      await triggerSysProxy(true)
      await patchAppConfig({ sysProxy: { enable: true } })
    } catch (e) {
      await patchAppConfig({ sysProxy: { enable: false } })
      console.error(e)
    }
  }

  return (
    <BasePage
      title="系统代理设置"
      header={
        <Button size="sm" color="primary" onPress={onSave}>
          保存
        </Button>
      }
    >
      {openPacEditor && (
        <PacEditorViewer
          script={values.pacScript || defaultPacScript}
          onCancel={() => setOpenPacEditor(false)}
          onConfirm={(script: string) => {
            setValues({ ...values, pacScript: script })
            setOpenPacEditor(false)
          }}
        />
      )}
      <SettingCard>
        <SettingItem title="代理主机" divider>
          <Input
            size="sm"
            className="w-[50%]"
            value={values.host}
            spellCheck={false}
            placeholder="默认127.0.0.1若无特殊需求请勿修改"
            onValueChange={(v) => {
              setValues({ ...values, host: v })
            }}
          />
        </SettingItem>
        <SettingItem title="代理模式" divider>
          <Tabs
            size="sm"
            color="primary"
            selectedKey={values.mode}
            onSelectionChange={(key: Key) => setValues({ ...values, mode: key as SysProxyMode })}
          >
            <Tab className="select-none" key="manual" title="手动" />
            <Tab className="select-none" key="auto" title="PAC" />
          </Tabs>
        </SettingItem>
        <SettingItem title="代理模式">
          <Button size="sm" onPress={() => setOpenPacEditor(true)} variant="bordered">
            编辑PAC脚本
          </Button>
        </SettingItem>
      </SettingCard>
    </BasePage>
  )
}

export default Sysproxy
