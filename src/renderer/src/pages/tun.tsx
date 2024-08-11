import { Button, Input, Switch, Tab, Tabs } from '@nextui-org/react'
import BasePage from '@renderer/components/base/base-page'
import SettingCard from '@renderer/components/base/base-setting-card'
import SettingItem from '@renderer/components/base/base-setting-item'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { restartCore, setupFirewall } from '@renderer/utils/ipc'
import { platform } from '@renderer/utils/init'
import React, { Key, useState } from 'react'

const Tun: React.FC = () => {
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()
  const { tun } = controledMihomoConfig || {}
  const [loading, setLoading] = useState(false)
  const {
    device = 'Mihomo',
    stack = 'mixed',
    'auto-route': autoRoute = true,
    'auto-redirect': autoRedirect = false,
    'auto-detect-interface': autoDetectInterface = true,
    'dns-hijack': dnsHijack = ['any:53'],
    'strict-route': strictRoute = false,
    mtu = 1500
  } = tun || {}

  const [values, setValues] = useState({
    device,
    stack,
    autoRoute,
    autoRedirect,
    autoDetectInterface,
    dnsHijack,
    strictRoute,
    mtu
  })

  const onSave = async (patch: Partial<IMihomoConfig>): Promise<void> => {
    await patchControledMihomoConfig(patch)
    await restartCore()
  }

  return (
    <BasePage
      title="Tun 设置"
      header={
        <Button
          size="sm"
          color="primary"
          onPress={() =>
            onSave({
              tun: {
                device: values.device,
                stack: values.stack,
                'auto-route': values.autoRoute,
                'auto-redirect': values.autoRedirect,
                'auto-detect-interface': values.autoDetectInterface,
                'dns-hijack': values.dnsHijack,
                'strict-route': values.strictRoute,
                mtu: values.mtu
              }
            })
          }
        >
          保存
        </Button>
      }
    >
      <SettingCard>
        {platform === 'win32' && (
          <SettingItem title="重设防火墙" divider>
            <Button
              size="sm"
              color="primary"
              isLoading={loading}
              onPress={() => {
                setLoading(true)
                setupFirewall()
                  .then(() => {
                    new Notification('防火墙重设成功')
                  })
                  .finally(() => setLoading(false))
              }}
            >
              重设防火墙
            </Button>
          </SettingItem>
        )}
        <SettingItem title="Tun 模式堆栈" divider>
          <Tabs
            size="sm"
            color="primary"
            selectedKey={values.stack}
            onSelectionChange={(key: Key) => setValues({ ...values, stack: key as TunStack })}
          >
            <Tab key="gvisor" title="用户" />
            <Tab key="mixed" title="混合" />
            <Tab key="system" title="系统" />
          </Tabs>
        </SettingItem>
        <SettingItem title="Tun 网卡名称" divider>
          <Input
            size="sm"
            className="w-[100px]"
            value={values.device}
            onValueChange={(v) => {
              setValues({ ...values, device: v })
            }}
          />
        </SettingItem>
        <SettingItem title="严格路由" divider>
          <Switch
            size="sm"
            isSelected={values.strictRoute}
            onValueChange={(v) => {
              setValues({ ...values, strictRoute: v })
            }}
          />
        </SettingItem>
        <SettingItem title="自动设置全局路由" divider>
          <Switch
            size="sm"
            isSelected={values.autoRoute}
            onValueChange={(v) => {
              setValues({ ...values, autoRoute: v })
            }}
          />
        </SettingItem>
        {platform === 'linux' && (
          <SettingItem title="自动设置TCP重定向" divider>
            <Switch
              size="sm"
              isSelected={values.autoRedirect}
              onValueChange={(v) => {
                setValues({ ...values, autoRedirect: v })
              }}
            />
          </SettingItem>
        )}
        <SettingItem title="自动选择流量出口接口" divider>
          <Switch
            size="sm"
            isSelected={values.autoDetectInterface}
            onValueChange={(v) => {
              setValues({ ...values, autoDetectInterface: v })
            }}
          />
        </SettingItem>
        <SettingItem title="MTU" divider>
          <Input
            size="sm"
            type="number"
            className="w-[100px]"
            value={values.mtu.toString()}
            onValueChange={(v) => {
              setValues({ ...values, mtu: parseInt(v) })
            }}
          />
        </SettingItem>
        <SettingItem title="DNS 劫持">
          <Input
            size="sm"
            className="w-[50%]"
            value={values.dnsHijack.join(',')}
            onValueChange={(v) => {
              const arr = v !== '' ? v.split(',') : []
              setValues({ ...values, dnsHijack: arr })
            }}
          />
        </SettingItem>
      </SettingCard>
    </BasePage>
  )
}

export default Tun
