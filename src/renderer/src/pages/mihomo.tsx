import { Button, Divider, Input, Select, SelectItem, Switch } from '@nextui-org/react'
import BasePage from '@renderer/components/base/base-page'
import SettingCard from '@renderer/components/base/base-setting-card'
import SettingItem from '@renderer/components/base/base-setting-item'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { platform } from '@renderer/utils/init'
import { FaNetworkWired } from 'react-icons/fa'
import { IoMdCloudDownload } from 'react-icons/io'
import PubSub from 'pubsub-js'
import {
  mihomoUpgrade,
  restartCore,
  startSubStoreBackendServer,
  triggerSysProxy
} from '@renderer/utils/ipc'
import React, { useState } from 'react'
import InterfaceModal from '@renderer/components/mihomo/interface-modal'
import { MdDeleteForever } from 'react-icons/md'

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
    'external-controller': externalController = '',
    secret,
    authentication = [],
    'skip-auth-prefixes': skipAuthPrefixes = ['127.0.0.1/32'],
    'log-level': logLevel = 'info',
    'find-process-mode': findProcessMode = 'strict',
    'allow-lan': allowLan,
    'lan-allowed-ips': lanAllowedIps = ['0.0.0.0/0', '::/0'],
    'lan-disallowed-ips': lanDisallowedIps = [],
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
  const [externalControllerInput, setExternalControllerInput] = useState(externalController)
  const [secretInput, setSecretInput] = useState(secret)
  const [lanAllowedIpsInput, setLanAllowedIpsInput] = useState(lanAllowedIps)
  const [lanDisallowedIpsInput, setLanDisallowedIpsInput] = useState(lanDisallowedIps)
  const [authenticationInput, setAuthenticationInput] = useState(authentication)
  const [skipAuthPrefixesInput, setSkipAuthPrefixesInput] = useState(skipAuthPrefixes)
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
                isLoading={upgrading}
                onPress={async () => {
                  try {
                    setUpgrading(true)
                    await mihomoUpgrade()
                    setTimeout(() => {
                      PubSub.publish('mihomo-core-changed')
                    }, 2000)
                    if (platform !== 'win32') {
                      new Notification('内核权限丢失', {
                        body: '内核升级成功，若要使用虚拟网卡（Tun），请到虚拟网卡页面重新手动授权内核'
                      })
                    }
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
              classNames={{ trigger: 'data-[hover=true]:bg-default-200' }}
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
                    await startSubStoreBackendServer()
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
          <SettingItem title="Socks 端口" divider>
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
          <SettingItem title="Http 端口" divider>
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
            <SettingItem title="Redir 端口" divider>
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
            <SettingItem title="TProxy 端口" divider>
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
              {externalControllerInput !== externalController && (
                <Button
                  size="sm"
                  color="primary"
                  className="mr-2"
                  onPress={() => {
                    onChangeNeedRestart({
                      'external-controller': externalControllerInput
                    })
                  }}
                >
                  确认
                </Button>
              )}

              <Input
                size="sm"
                className="w-[200px]"
                value={externalControllerInput}
                onValueChange={(v) => {
                  setExternalControllerInput(v)
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
          {allowLan && (
            <>
              <SettingItem title="允许连接的 IP 段">
                {lanAllowedIpsInput.join('') !== lanAllowedIps.join('') && (
                  <Button
                    size="sm"
                    color="primary"
                    onPress={() => {
                      onChangeNeedRestart({ 'lan-allowed-ips': lanAllowedIpsInput })
                    }}
                  >
                    确认
                  </Button>
                )}
              </SettingItem>
              <div className="flex flex-col items-stretch mt-2">
                {[...lanAllowedIpsInput, ''].map((ipcidr, index) => {
                  return (
                    <div key={index} className="flex mb-2">
                      <Input
                        size="sm"
                        fullWidth
                        placeholder="IP 段"
                        value={ipcidr || ''}
                        onValueChange={(v) => {
                          if (index === lanAllowedIpsInput.length) {
                            setLanAllowedIpsInput([...lanAllowedIpsInput, v])
                          } else {
                            setLanAllowedIpsInput(
                              lanAllowedIpsInput.map((a, i) => (i === index ? v : a))
                            )
                          }
                        }}
                      />
                      {index < lanAllowedIpsInput.length && (
                        <Button
                          className="ml-2"
                          size="sm"
                          variant="flat"
                          color="warning"
                          onClick={() =>
                            setLanAllowedIpsInput(lanAllowedIpsInput.filter((_, i) => i !== index))
                          }
                        >
                          <MdDeleteForever className="text-lg" />
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
              <Divider className="mb-2" />
              <SettingItem title="禁止连接的 IP 段">
                {lanDisallowedIpsInput.join('') !== lanDisallowedIps.join('') && (
                  <Button
                    size="sm"
                    color="primary"
                    onPress={() => {
                      onChangeNeedRestart({ 'lan-disallowed-ips': lanDisallowedIpsInput })
                    }}
                  >
                    确认
                  </Button>
                )}
              </SettingItem>
              <div className="flex flex-col items-stretch mt-2">
                {[...lanDisallowedIpsInput, ''].map((ipcidr, index) => {
                  return (
                    <div key={index} className="flex mb-2">
                      <Input
                        size="sm"
                        fullWidth
                        placeholder="IP 段"
                        value={ipcidr || ''}
                        onValueChange={(v) => {
                          if (index === lanDisallowedIpsInput.length) {
                            setLanDisallowedIpsInput([...lanDisallowedIpsInput, v])
                          } else {
                            setLanDisallowedIpsInput(
                              lanDisallowedIpsInput.map((a, i) => (i === index ? v : a))
                            )
                          }
                        }}
                      />
                      {index < lanDisallowedIpsInput.length && (
                        <Button
                          className="ml-2"
                          size="sm"
                          variant="flat"
                          color="warning"
                          onClick={() =>
                            setLanDisallowedIpsInput(
                              lanDisallowedIpsInput.filter((_, i) => i !== index)
                            )
                          }
                        >
                          <MdDeleteForever className="text-lg" />
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
              <Divider className="mb-2" />
            </>
          )}
          <SettingItem title="用户验证">
            {authenticationInput.join('') !== authentication.join('') && (
              <Button
                size="sm"
                color="primary"
                onPress={() => {
                  onChangeNeedRestart({ authentication: authenticationInput })
                }}
              >
                确认
              </Button>
            )}
          </SettingItem>
          <div className="flex flex-col items-stretch mt-2">
            {[...authenticationInput, ''].map((auth, index) => {
              const [user, pass] = auth.split(':')
              return (
                <div key={index} className="flex mb-2">
                  <div className="flex-[4]">
                    <Input
                      size="sm"
                      fullWidth
                      placeholder="用户名"
                      value={user || ''}
                      onValueChange={(v) => {
                        if (index === authenticationInput.length) {
                          setAuthenticationInput([...authenticationInput, `${v}:${pass || ''}`])
                        } else {
                          setAuthenticationInput(
                            authenticationInput.map((a, i) =>
                              i === index ? `${v}:${pass || ''}` : a
                            )
                          )
                        }
                      }}
                    />
                  </div>
                  <span className="mx-2">:</span>
                  <div className="flex-[6] flex">
                    <Input
                      size="sm"
                      fullWidth
                      placeholder="密码"
                      value={pass || ''}
                      onValueChange={(v) => {
                        if (index === authenticationInput.length) {
                          setAuthenticationInput([...authenticationInput, `${user || ''}:${v}`])
                        } else {
                          setAuthenticationInput(
                            authenticationInput.map((a, i) =>
                              i === index ? `${user || ''}:${v}` : a
                            )
                          )
                        }
                      }}
                    />
                    {index < authenticationInput.length && (
                      <Button
                        className="ml-2"
                        size="sm"
                        variant="flat"
                        color="warning"
                        onClick={() =>
                          setAuthenticationInput(authenticationInput.filter((_, i) => i !== index))
                        }
                      >
                        <MdDeleteForever className="text-lg" />
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <Divider className="mb-2" />
          <SettingItem title="允许跳过验证的 IP 段">
            {skipAuthPrefixesInput.join('') !== skipAuthPrefixes.join('') && (
              <Button
                size="sm"
                color="primary"
                onPress={() => {
                  onChangeNeedRestart({ 'skip-auth-prefixes': skipAuthPrefixesInput })
                }}
              >
                确认
              </Button>
            )}
          </SettingItem>
          <div className="flex flex-col items-stretch mt-2">
            {[...skipAuthPrefixesInput, ''].map((ipcidr, index) => {
              return (
                <div key={index} className="flex mb-2">
                  <Input
                    disabled={index === 0}
                    size="sm"
                    fullWidth
                    placeholder="IP 段"
                    value={ipcidr || ''}
                    onValueChange={(v) => {
                      if (index === skipAuthPrefixesInput.length) {
                        setSkipAuthPrefixesInput([...skipAuthPrefixesInput, v])
                      } else {
                        setSkipAuthPrefixesInput(
                          skipAuthPrefixesInput.map((a, i) => (i === index ? v : a))
                        )
                      }
                    }}
                  />
                  {index < skipAuthPrefixesInput.length && index !== 0 && (
                    <Button
                      className="ml-2"
                      size="sm"
                      variant="flat"
                      color="warning"
                      onClick={() =>
                        setSkipAuthPrefixesInput(
                          skipAuthPrefixesInput.filter((_, i) => i !== index)
                        )
                      }
                    >
                      <MdDeleteForever className="text-lg" />
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
          <Divider className="mb-2" />
          <SettingItem title="使用 RTT 延迟测试" divider>
            <Switch
              size="sm"
              isSelected={unifiedDelay}
              onValueChange={(v) => {
                onChangeNeedRestart({ 'unified-delay': v })
              }}
            />
          </SettingItem>
          <SettingItem title="TCP 并发" divider>
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
          <SettingItem title="存储 FakeIP" divider>
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
              classNames={{ trigger: 'data-[hover=true]:bg-default-200' }}
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
              classNames={{ trigger: 'data-[hover=true]:bg-default-200' }}
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
