import { Button, Divider, Input, Select, SelectItem, Switch } from '@heroui/react'
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
import { useTranslation } from 'react-i18next'

const CoreMap = {
  mihomo: 'mihomo.stableVersion',
  'mihomo-alpha': 'mihomo.alphaVersion'
}

const Mihomo: React.FC = () => {
  const { t } = useTranslation()
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
      <BasePage title={t('mihomo.title')}>
        <SettingCard>
          <SettingItem
            title={t('mihomo.coreVersion')}
            actions={
              <Button
                size="sm"
                isIconOnly
                title={t('mihomo.upgradeCore')}
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
                      new Notification(t('mihomo.coreAuthLost'), {
                        body: t('mihomo.coreUpgradeSuccess')
                      })
                    }
                  } catch (e) {
                    if (typeof e === 'string' && e.includes('already using latest version')) {
                      new Notification(t('mihomo.alreadyLatestVersion'))
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
              aria-label={t('mihomo.selectCoreVersion')}
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
              <SelectItem key="mihomo">{t(CoreMap['mihomo'])}</SelectItem>
              <SelectItem key="mihomo-alpha">{t(CoreMap['mihomo-alpha'])}</SelectItem>
            </Select>
          </SettingItem>
          <SettingItem title={t('mihomo.mixedPort')} divider>
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
                  {t('mihomo.confirm')}
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
          <SettingItem title={t('mihomo.socksPort')} divider>
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
                  {t('mihomo.confirm')}
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
          <SettingItem title={t('mihomo.httpPort')} divider>
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
                  {t('mihomo.confirm')}
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
            <SettingItem title={t('mihomo.redirPort')} divider>
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
                    {t('mihomo.confirm')}
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
                    {t('mihomo.confirm')}
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
          <SettingItem title={t('mihomo.externalController')} divider>
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
                  {t('mihomo.confirm')}
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
          <SettingItem title={t('mihomo.externalControllerSecret')} divider>
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
                  {t('mihomo.confirm')}
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
          <SettingItem title={t('mihomo.ipv6')} divider>
            <Switch
              size="sm"
              isSelected={ipv6}
              onValueChange={(v) => {
                onChangeNeedRestart({ ipv6: v })
              }}
            />
          </SettingItem>
          <SettingItem
            title={t('mihomo.allowLanConnection')}
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
              <SettingItem title={t('mihomo.allowedIpSegments')}>
                {lanAllowedIpsInput.join('') !== lanAllowedIps.join('') && (
                  <Button
                    size="sm"
                    color="primary"
                    onPress={() => {
                      onChangeNeedRestart({ 'lan-allowed-ips': lanAllowedIpsInput })
                    }}
                  >
                    {t('mihomo.confirm')}
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
                          onPress={() =>
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
              <SettingItem title={t('mihomo.disallowedIpSegments')}>
                {lanDisallowedIpsInput.join('') !== lanDisallowedIps.join('') && (
                  <Button
                    size="sm"
                    color="primary"
                    onPress={() => {
                      onChangeNeedRestart({ 'lan-disallowed-ips': lanDisallowedIpsInput })
                    }}
                  >
                    {t('mihomo.confirm')}
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
                          onPress={() =>
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
          <SettingItem title={t('mihomo.userVerification')}>
            {authenticationInput.join('') !== authentication.join('') && (
              <Button
                size="sm"
                color="primary"
                onPress={() => {
                  onChangeNeedRestart({ authentication: authenticationInput })
                }}
              >
                {t('mihomo.confirm')}
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
                      placeholder={t('mihomo.username.placeholder')}
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
                      placeholder={t('mihomo.password.placeholder')}
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
                        onPress={() =>
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
          <SettingItem title={t('mihomo.skipAuthPrefixes')}>
            {skipAuthPrefixesInput.join('') !== skipAuthPrefixes.join('') && (
              <Button
                size="sm"
                color="primary"
                onPress={() => {
                  onChangeNeedRestart({ 'skip-auth-prefixes': skipAuthPrefixesInput })
                }}
              >
                {t('mihomo.confirm')}
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
                    placeholder={t('mihomo.ipSegment.placeholder')}
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
                      onPress={() =>
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
          <SettingItem title={t('mihomo.useRttDelayTest')} divider>
            <Switch
              size="sm"
              isSelected={unifiedDelay}
              onValueChange={(v) => {
                onChangeNeedRestart({ 'unified-delay': v })
              }}
            />
          </SettingItem>
          <SettingItem title={t('mihomo.tcpConcurrent')} divider>
            <Switch
              size="sm"
              isSelected={tcpConcurrent}
              onValueChange={(v) => {
                onChangeNeedRestart({ 'tcp-concurrent': v })
              }}
            />
          </SettingItem>
          <SettingItem title={t('mihomo.storeSelectedNode')} divider>
            <Switch
              size="sm"
              isSelected={storeSelected}
              onValueChange={(v) => {
                onChangeNeedRestart({ profile: { 'store-selected': v } })
              }}
            />
          </SettingItem>
          <SettingItem title={t('mihomo.storeFakeIp')} divider>
            <Switch
              size="sm"
              isSelected={storeFakeIp}
              onValueChange={(v) => {
                onChangeNeedRestart({ profile: { 'store-fake-ip': v } })
              }}
            />
          </SettingItem>
          <SettingItem title={t('mihomo.logRetentionDays')} divider>
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
          <SettingItem title={t('mihomo.logLevel')} divider>
            <Select
              classNames={{ trigger: 'data-[hover=true]:bg-default-200' }}
              className="w-[100px]"
              size="sm"
              aria-label={t('mihomo.selectLogLevel')}
              selectedKeys={new Set([logLevel])}
              onSelectionChange={(v) => {
                onChangeNeedRestart({ 'log-level': v.currentKey as LogLevel })
              }}
            >
              <SelectItem key="silent">{t('mihomo.silent')}</SelectItem>
              <SelectItem key="error">{t('mihomo.error')}</SelectItem>
              <SelectItem key="warning">{t('mihomo.warning')}</SelectItem>
              <SelectItem key="info">{t('mihomo.info')}</SelectItem>
              <SelectItem key="debug">{t('mihomo.debug')}</SelectItem>
            </Select>
          </SettingItem>
          <SettingItem title={t('mihomo.findProcess')} divider>
            <Select
              classNames={{ trigger: 'data-[hover=true]:bg-default-200' }}
              className="w-[100px]"
              size="sm"
              aria-label={t('mihomo.selectFindProcessMode')}
              selectedKeys={new Set([findProcessMode])}
              onSelectionChange={(v) => {
                onChangeNeedRestart({ 'find-process-mode': v.currentKey as FindProcessMode })
              }}
            >
              <SelectItem key="strict">{t('mihomo.strict')}</SelectItem>
              <SelectItem key="off">{t('mihomo.off')}</SelectItem>
              <SelectItem key="always">{t('mihomo.always')}</SelectItem>
            </Select>
          </SettingItem>
        </SettingCard>
      </BasePage>
    </>
  )
}

export default Mihomo
