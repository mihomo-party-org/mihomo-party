import { Button, Input, Select, SelectItem, Switch } from '@nextui-org/react'
import BasePage from '@renderer/components/base/base-page'
import SettingCard from '@renderer/components/base/base-setting-card'
import SettingItem from '@renderer/components/base/base-setting-item'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { platform } from '@renderer/utils/init'
import { FaNetworkWired } from 'react-icons/fa'
import { IoMdCloudDownload } from 'react-icons/io'
import { mihomoUpgrade, restartCore, triggerSysProxy } from '@renderer/utils/ipc'
import React, { useState } from 'react'
import InterfaceModal from '@renderer/components/mihomo/interface-modal'

const CoreMap = {
  mihomo: '稳定版',
  'mihomo-alpha': '预览版'
}

const Mihomo: React.FC = () => {
  const { appConfig, patchAppConfig } = useAppConfig()
  const { core = 'mihomo', maxLogDays = 7, sysProxy } = appConfig || {}
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()
  const {
    ipv6,
    'external-controller': externalController = '127.0.0.1:9090',
    secret,
    'log-level': logLevel = 'info',
    'find-process-mode': findProcessMode = 'strict',
    'allow-lan': allowLan,
    'unified-delay': unifiedDelay,
    'tcp-concurrent': tcpConcurrent,
    'mixed-port': mixedPort = 7890,
    'socks-port': socksPort = 7891,
    port: httpPort = 7892,
    'redir-port': redirPort = 0,
    'tproxy-port': tproxyPort = 0,
    profile = {}
  } = controledMihomoConfig || {}
  const { 'store-selected': storeSelected, 'store-fake-ip': storeFakeIp } = profile

  const [mixedPortInput, setMixedPortInput] = useState(mixedPort)
  const [socksPortInput, setSocksPortInput] = useState(socksPort)
  const [httpPortInput, setHttpPortInput] = useState(httpPort)
  const [redirPortInput, setRedirPortInput] = useState(redirPort)
  const [tproxyPortInput, setTproxyPortInput] = useState(tproxyPort)
  const [externalControllerServerInput, setExternalControllerServerInput] = useState(
    externalController.split(':')[0]
  )
  const [externalControllerPortInput, setExternalControllerPortInput] = useState(
    externalController.split(':')[1]
  )
  const [secretInput, setSecretInput] = useState(secret)

  const [upgrading, setUpgrading] = useState(false)
  const [lanOpen, setLanOpen] = useState(false)

  const onChangeNeedRestart = async (patch: Partial<IMihomoConfig>): Promise<void> => {
    await patchControledMihomoConfig(patch)
    await restartCore()
  }

  return (
    <>
      {lanOpen && <InterfaceModal onClose={() => setLanOpen(false)} />}
      <BasePage title="内核设置">
        <SettingCard>
          <SettingItem
            title="内核版本"
            actions={
              <Button
                size="sm"
                isIconOnly
                title="升级内核"
                variant="light"
                className="ml-2"
                isLoading={upgrading}
                onPress={async () => {
                  try {
                    setUpgrading(true)
                    await mihomoUpgrade()
                    setTimeout(() => {
                      PubSub.publish('mihomo-core-changed')
                    }, 2000)
                  } catch (e) {
                    if (typeof e === 'string' && e.includes('already using latest version')) {
                      new Notification('已经是最新版本')
                    } else {
                      alert(e)
                    }
                  } finally {
                    setUpgrading(false)
                  }
                }}
              >
                <IoMdCloudDownload className="text-lg" />
              </Button>
            }
            divider
          >
            <Select
              className="w-[100px]"
              size="sm"
              selectedKeys={new Set([core])}
              onSelectionChange={async (v) => {
                try {
                  await patchAppConfig({ core: v.currentKey as 'mihomo' | 'mihomo-alpha' })
                  await restartCore()
                } catch (e) {
                  alert(e)
                } finally {
                  PubSub.publish('mihomo-core-changed')
                }
              }}
            >
              <SelectItem key="mihomo">{CoreMap['mihomo']}</SelectItem>
              <SelectItem key="mihomo-alpha">{CoreMap['mihomo-alpha']}</SelectItem>
            </Select>
          </SettingItem>
          <SettingItem title="混合端口" divider>
            <div className="flex">
              {mixedPortInput !== mixedPort && (
                <Button
                  size="sm"
                  color="primary"
                  className="mr-2"
                  onPress={async () => {
                    await onChangeNeedRestart({ 'mixed-port': mixedPortInput })
                    if (sysProxy?.enable) {
                      triggerSysProxy(true)
                    }
                  }}
                >
                  确认
                </Button>
              )}

              <Input
                size="sm"
                type="number"
                className="w-[100px]"
                value={mixedPortInput.toString()}
                max={65535}
                min={0}
                onValueChange={(v) => {
                  setMixedPortInput(parseInt(v))
                }}
              />
            </div>
          </SettingItem>
          <SettingItem title="Socks端口" divider>
            <div className="flex">
              {socksPortInput !== socksPort && (
                <Button
                  size="sm"
                  color="primary"
                  className="mr-2"
                  onPress={() => {
                    onChangeNeedRestart({ 'socks-port': socksPortInput })
                  }}
                >
                  确认
                </Button>
              )}

              <Input
                size="sm"
                type="number"
                className="w-[100px]"
                value={socksPortInput.toString()}
                max={65535}
                min={0}
                onValueChange={(v) => {
                  setSocksPortInput(parseInt(v))
                }}
              />
            </div>
          </SettingItem>
          <SettingItem title="Http端口" divider>
            <div className="flex">
              {httpPortInput !== httpPort && (
                <Button
                  size="sm"
                  color="primary"
                  className="mr-2"
                  onPress={() => {
                    onChangeNeedRestart({ port: httpPortInput })
                  }}
                >
                  确认
                </Button>
              )}

              <Input
                size="sm"
                type="number"
                className="w-[100px]"
                value={httpPortInput.toString()}
                max={65535}
                min={0}
                onValueChange={(v) => {
                  setHttpPortInput(parseInt(v))
                }}
              />
            </div>
          </SettingItem>
          {platform !== 'win32' && (
            <SettingItem title="Redir端口" divider>
              <div className="flex">
                {redirPortInput !== redirPort && (
                  <Button
                    size="sm"
                    color="primary"
                    className="mr-2"
                    onPress={() => {
                      onChangeNeedRestart({ 'redir-port': redirPortInput })
                    }}
                  >
                    确认
                  </Button>
                )}

                <Input
                  size="sm"
                  type="number"
                  className="w-[100px]"
                  value={redirPortInput.toString()}
                  max={65535}
                  min={0}
                  onValueChange={(v) => {
                    setRedirPortInput(parseInt(v))
                  }}
                />
              </div>
            </SettingItem>
          )}
          {platform === 'linux' && (
            <SettingItem title="TProxy端口" divider>
              <div className="flex">
                {tproxyPortInput !== tproxyPort && (
                  <Button
                    size="sm"
                    color="primary"
                    className="mr-2"
                    onPress={() => {
                      onChangeNeedRestart({ 'tproxy-port': tproxyPortInput })
                    }}
                  >
                    确认
                  </Button>
                )}

                <Input
                  size="sm"
                  type="number"
                  className="w-[100px]"
                  value={tproxyPortInput.toString()}
                  max={65535}
                  min={0}
                  onValueChange={(v) => {
                    setTproxyPortInput(parseInt(v))
                  }}
                />
              </div>
            </SettingItem>
          )}
          <SettingItem title="外部控制地址" divider>
            <div className="flex">
              {externalControllerServerInput !== externalController.split(':')[0] && (
                <Button
                  size="sm"
                  color="primary"
                  className="mr-2"
                  onPress={() => {
                    onChangeNeedRestart({
                      'external-controller': `${externalControllerServerInput}:${externalControllerPortInput}`
                    })
                  }}
                >
                  确认
                </Button>
              )}

              <Input
                size="sm"
                className="w-[200px]"
                value={externalControllerServerInput}
                onValueChange={(v) => {
                  setExternalControllerServerInput(v)
                }}
              />
            </div>
          </SettingItem>
          <SettingItem title="外部控制端口" divider>
            <div className="flex">
              {externalControllerPortInput !== externalController.split(':')[1] && (
                <Button
                  size="sm"
                  color="primary"
                  className="mr-2"
                  onPress={() => {
                    onChangeNeedRestart({
                      'external-controller': `${externalControllerServerInput}:${externalControllerPortInput}`
                    })
                  }}
                >
                  确认
                </Button>
              )}

              <Input
                size="sm"
                type="number"
                max={65535}
                min={0}
                className="w-[200px]"
                value={externalControllerPortInput}
                onValueChange={(v) => {
                  setExternalControllerPortInput(v)
                }}
              />
            </div>
          </SettingItem>
          <SettingItem title="外部控制访问密钥" divider>
            <div className="flex">
              {secretInput !== secret && (
                <Button
                  size="sm"
                  color="primary"
                  className="mr-2"
                  onPress={() => {
                    onChangeNeedRestart({ secret: secretInput })
                  }}
                >
                  确认
                </Button>
              )}

              <Input
                size="sm"
                type="password"
                className="w-[200px]"
                value={secretInput}
                onValueChange={(v) => {
                  setSecretInput(v)
                }}
              />
            </div>
          </SettingItem>
          <SettingItem title="IPv6" divider>
            <Switch
              size="sm"
              isSelected={ipv6}
              onValueChange={(v) => {
                onChangeNeedRestart({ ipv6: v })
              }}
            />
          </SettingItem>
          <SettingItem
            title="允许局域网连接"
            actions={
              <Button
                size="sm"
                isIconOnly
                variant="light"
                className="ml-2"
                onPress={() => {
                  setLanOpen(true)
                }}
              >
                <FaNetworkWired className="text-lg" />
              </Button>
            }
            divider
          >
            <Switch
              size="sm"
              isSelected={allowLan}
              onValueChange={(v) => {
                onChangeNeedRestart({ 'allow-lan': v })
              }}
            />
          </SettingItem>
          <SettingItem title="使用RTT延迟测试" divider>
            <Switch
              size="sm"
              isSelected={unifiedDelay}
              onValueChange={(v) => {
                onChangeNeedRestart({ 'unified-delay': v })
              }}
            />
          </SettingItem>
          <SettingItem title="TCP并发" divider>
            <Switch
              size="sm"
              isSelected={tcpConcurrent}
              onValueChange={(v) => {
                onChangeNeedRestart({ 'tcp-concurrent': v })
              }}
            />
          </SettingItem>
          <SettingItem title="存储选择节点" divider>
            <Switch
              size="sm"
              isSelected={storeSelected}
              onValueChange={(v) => {
                onChangeNeedRestart({ profile: { 'store-selected': v } })
              }}
            />
          </SettingItem>
          <SettingItem title="存储FakeIP" divider>
            <Switch
              size="sm"
              isSelected={storeFakeIp}
              onValueChange={(v) => {
                onChangeNeedRestart({ profile: { 'store-fake-ip': v } })
              }}
            />
          </SettingItem>
          <SettingItem title="日志保留天数" divider>
            <Input
              size="sm"
              type="number"
              className="w-[100px]"
              value={maxLogDays.toString()}
              onValueChange={(v) => {
                patchAppConfig({ maxLogDays: parseInt(v) })
              }}
            />
          </SettingItem>
          <SettingItem title="日志等级" divider>
            <Select
              className="w-[100px]"
              size="sm"
              selectedKeys={new Set([logLevel])}
              onSelectionChange={(v) => {
                onChangeNeedRestart({ 'log-level': v.currentKey as LogLevel })
              }}
            >
              <SelectItem key="silent">静默</SelectItem>
              <SelectItem key="error">错误</SelectItem>
              <SelectItem key="warning">警告</SelectItem>
              <SelectItem key="info">信息</SelectItem>
              <SelectItem key="debug">调试</SelectItem>
            </Select>
          </SettingItem>
          <SettingItem title="查找进程">
            <Select
              className="w-[100px]"
              size="sm"
              selectedKeys={new Set([findProcessMode])}
              onSelectionChange={(v) => {
                onChangeNeedRestart({ 'find-process-mode': v.currentKey as FindProcessMode })
              }}
            >
              <SelectItem key="strict">自动</SelectItem>
              <SelectItem key="off">关闭</SelectItem>
              <SelectItem key="always">开启</SelectItem>
            </Select>
          </SettingItem>
        </SettingCard>
      </BasePage>
    </>
  )
}

export default Mihomo
