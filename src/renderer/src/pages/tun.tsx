import { Button, Input, Switch, Tab, Tabs } from '@nextui-org/react'
import BasePage from '@renderer/components/base/base-page'
import SettingCard from '@renderer/components/base/base-setting-card'
import SettingItem from '@renderer/components/base/base-setting-item'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { manualGrantCorePermition, restartCore, setupFirewall } from '@renderer/utils/ipc'
import { platform } from '@renderer/utils/init'
import React, { Key, useState } from 'react'
import BasePasswordModal from '@renderer/components/base/base-password-modal'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { MdDeleteForever } from 'react-icons/md'

const Tun: React.FC = () => {
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()
  const { appConfig, patchAppConfig } = useAppConfig()
  const { autoSetDNS = true } = appConfig || {}
  const { tun } = controledMihomoConfig || {}
  const [loading, setLoading] = useState(false)
  const [openPasswordModal, setOpenPasswordModal] = useState(false)
  const {
    device = 'Mihomo',
    stack = 'mixed',
    'auto-route': autoRoute = true,
    'auto-redirect': autoRedirect = false,
    'auto-detect-interface': autoDetectInterface = true,
    'dns-hijack': dnsHijack = ['any:53'],
    'route-exclude-address': routeExcludeAddress = [],
    'strict-route': strictRoute = false,
    mtu = 1500
  } = tun || {}
  const [changed, setChanged] = useState(false)
  const [values, originSetValues] = useState({
    device,
    stack,
    autoRoute,
    autoRedirect,
    autoDetectInterface,
    dnsHijack,
    strictRoute,
    routeExcludeAddress,
    mtu
  })
  const setValues = (v: typeof values): void => {
    originSetValues(v)
    setChanged(true)
  }

  const handleExcludeAddressChange = (value: string, index: number): void => {
    const newExcludeAddresses = [...values.routeExcludeAddress]
    if (index === newExcludeAddresses.length) {
      if (value.trim() !== '') {
        newExcludeAddresses.push(value)
      }
    } else {
      if (value.trim() === '') {
        newExcludeAddresses.splice(index, 1)
      } else {
        newExcludeAddresses[index] = value
      }
    }
    setValues({ ...values, routeExcludeAddress: newExcludeAddresses })
  }

  const onSave = async (patch: Partial<IMihomoConfig>): Promise<void> => {
    await patchControledMihomoConfig(patch)
    await restartCore()
    setChanged(false)
  }

  return (
    <>
      {openPasswordModal && (
        <BasePasswordModal
          onCancel={() => setOpenPasswordModal(false)}
          onConfirm={async (password: string) => {
            try {
              await manualGrantCorePermition(password)
              new Notification('内核授权成功')
              await restartCore()
              setOpenPasswordModal(false)
            } catch (e) {
              alert(e)
            }
          }}
        />
      )}
      <BasePage
        title="虚拟网卡设置"
        header={
          changed && (
            <Button
              size="sm"
              className="app-nodrag"
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
                    'route-exclude-address': values.routeExcludeAddress,
                    mtu: values.mtu
                  }
                })
              }
            >
              保存
            </Button>
          )
        }
      >
        <SettingCard className="tun-settings">
          {platform === 'win32' && (
            <SettingItem title="重设防火墙" divider>
              <Button
                size="sm"
                color="primary"
                isLoading={loading}
                onPress={async () => {
                  setLoading(true)
                  try {
                    await setupFirewall()
                    new Notification('防火墙重设成功')
                    await restartCore()
                  } catch (e) {
                    alert(e)
                  } finally {
                    setLoading(false)
                  }
                }}
              >
                重设防火墙
              </Button>
            </SettingItem>
          )}
          {platform !== 'win32' && (
            <SettingItem title="手动授权内核" divider>
              <Button
                size="sm"
                color="primary"
                onPress={async () => {
                  if (platform === 'darwin') {
                    try {
                      await manualGrantCorePermition()
                      new Notification('内核授权成功')
                      await restartCore()
                    } catch (e) {
                      alert(e)
                    }
                  } else {
                    setOpenPasswordModal(true)
                  }
                }}
              >
                手动授权内核
              </Button>
            </SettingItem>
          )}
          {platform === 'darwin' && (
            <SettingItem title="自动设置系统DNS" divider>
              <Switch
                size="sm"
                isSelected={autoSetDNS}
                onValueChange={async (v) => {
                  await patchAppConfig({ autoSetDNS: v })
                }}
              />
            </SettingItem>
          )}

          <SettingItem title="Tun 模式堆栈" divider>
            <Tabs
              size="sm"
              color="primary"
              selectedKey={values.stack}
              onSelectionChange={(key: Key) => setValues({ ...values, stack: key as TunStack })}
            >
              <Tab key="gvisor" title="gVisor" />
              <Tab key="mixed" title="Mixed" />
              <Tab key="system" title="System" />
            </Tabs>
          </SettingItem>
          {platform !== 'darwin' && (
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
          )}

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
          <SettingItem title="DNS 劫持" divider>
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
          <div className="flex flex-col items-stretch">
            <h3 className="mb-2">排除自定义网段</h3>
            {[...values.routeExcludeAddress, ''].map((address, index) => (
              <div key={index} className="mb-2 flex">
                <Input
                  fullWidth
                  size="sm"
                  placeholder="例: 172.20.0.0/16"
                  value={address}
                  onValueChange={(v) => handleExcludeAddressChange(v, index)}
                />
                {index < values.routeExcludeAddress.length && (
                  <Button
                    className="ml-2"
                    size="sm"
                    variant="flat"
                    color="warning"
                    onClick={() => handleExcludeAddressChange('', index)}
                  >
                    <MdDeleteForever className="text-lg" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </SettingCard>
      </BasePage>
    </>
  )
}

export default Tun
