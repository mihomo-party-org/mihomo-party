import { Button, Input, Tab, Tabs } from '@nextui-org/react'
import BasePage from '@renderer/components/base/base-page'
import SettingCard from '@renderer/components/base/base-setting-card'
import SettingItem from '@renderer/components/base/base-setting-item'
import PacEditorModal from '@renderer/components/sysproxy/pac-editor-modal'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { platform } from '@renderer/utils/init'
import { openUWPTool, triggerSysProxy } from '@renderer/utils/ipc'
import { Key, useState } from 'react'
import React from 'react'
import { MdDeleteForever } from 'react-icons/md'

const defaultBypass: string[] =
  platform === 'linux'
    ? ['localhost', '127.0.0.1', '192.168.0.0/16', '10.0.0.0/8', '172.16.0.0/12', '::1']
    : platform === 'darwin'
      ? [
          '127.0.0.1',
          '192.168.0.0/16',
          '10.0.0.0/8',
          '172.16.0.0/12',
          'localhost',
          '*.local',
          '*.crashlytics.com',
          '<local>'
        ]
      : [
          'localhost',
          '127.*',
          '192.168.*',
          '10.*',
          '172.16.*',
          '172.17.*',
          '172.18.*',
          '172.19.*',
          '172.20.*',
          '172.21.*',
          '172.22.*',
          '172.23.*',
          '172.24.*',
          '172.25.*',
          '172.26.*',
          '172.27.*',
          '172.28.*',
          '172.29.*',
          '172.30.*',
          '172.31.*',
          '<local>'
        ]

const defaultPacScript = `
function FindProxyForURL(url, host) {
  return "PROXY 127.0.0.1:%mixed-port%; SOCKS5 127.0.0.1:%mixed-port%; DIRECT;";
}
`

const Sysproxy: React.FC = () => {
  const { appConfig, patchAppConfig } = useAppConfig()
  const { sysProxy } = appConfig || ({ sysProxy: { enable: false } } as IAppConfig)
  const [changed, setChanged] = useState(false)
  const [values, originSetValues] = useState({
    enable: sysProxy.enable,
    host: sysProxy.host ?? '',
    bypass: sysProxy.bypass ?? defaultBypass,
    mode: sysProxy.mode ?? 'manual',
    pacScript: sysProxy.pacScript ?? defaultPacScript
  })

  const setValues = (v: typeof values): void => {
    originSetValues(v)
    setChanged(true)
  }

  const [openPacEditor, setOpenPacEditor] = useState(false)

  const handleBypassChange = (value: string, index: number): void => {
    const newBypass = [...values.bypass]
    if (index === newBypass.length) {
      if (value.trim() !== '') {
        newBypass.push(value)
      }
    } else {
      if (value.trim() === '') {
        newBypass.splice(index, 1)
      } else {
        newBypass[index] = value
      }
    }
    setValues({ ...values, bypass: newBypass })
  }

  const onSave = async (): Promise<void> => {
    // check valid TODO
    await patchAppConfig({ sysProxy: values })
    try {
      await triggerSysProxy(true)
      await patchAppConfig({ sysProxy: { enable: true } })
      setChanged(false)
    } catch (e) {
      alert(e)
      await patchAppConfig({ sysProxy: { enable: false } })
    }
  }

  return (
    <BasePage
      title="系统代理设置"
      header={
        changed && (
          <Button color="primary" className="app-nodrag" size="sm" onPress={onSave}>
            保存
          </Button>
        )
      }
    >
      {openPacEditor && (
        <PacEditorModal
          script={values.pacScript || defaultPacScript}
          onCancel={() => setOpenPacEditor(false)}
          onConfirm={(script: string) => {
            setValues({ ...values, pacScript: script })
            setOpenPacEditor(false)
          }}
        />
      )}
      <SettingCard className="sysproxy-settings">
        <SettingItem title="代理主机" divider>
          <Input
            size="sm"
            className="w-[50%]"
            value={values.host}
            placeholder="默认 127.0.0.1 若无特殊需求请勿修改"
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
            <Tab key="manual" title="手动" />
            <Tab key="auto" title="PAC" />
          </Tabs>
        </SettingItem>
        {platform === 'win32' && (
          <SettingItem title="UWP 工具" divider>
            <Button
              size="sm"
              onPress={async () => {
                await openUWPTool()
              }}
            >
              打开 UWP 工具
            </Button>
          </SettingItem>
        )}

        {values.mode === 'auto' && (
          <SettingItem title="代理模式">
            <Button size="sm" onPress={() => setOpenPacEditor(true)} variant="bordered">
              编辑 PAC 脚本
            </Button>
          </SettingItem>
        )}
        {values.mode === 'manual' && (
          <>
            <SettingItem title="添加默认代理绕过" divider>
              <Button
                size="sm"
                onPress={() => {
                  setValues({ ...values, bypass: defaultBypass.concat(values.bypass) })
                }}
              >
                添加默认代理绕过
              </Button>
            </SettingItem>
            <div className="flex flex-col items-stretch">
              <h3 className="mb-2">代理绕过</h3>
              {[...values.bypass, ''].map((domain, index) => (
                <div key={index} className="mb-2 flex">
                  <Input
                    fullWidth
                    size="sm"
                    placeholder="例: *.baidu.com"
                    value={domain}
                    onValueChange={(v) => handleBypassChange(v, index)}
                  />
                  {index < values.bypass.length && (
                    <Button
                      className="ml-2"
                      size="sm"
                      variant="flat"
                      color="warning"
                      onClick={() => handleBypassChange('', index)}
                    >
                      <MdDeleteForever className="text-lg" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </SettingCard>
    </BasePage>
  )
}

export default Sysproxy
