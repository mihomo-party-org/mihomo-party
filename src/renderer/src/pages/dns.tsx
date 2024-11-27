import { Button, Tab, Input, Switch, Tabs, Divider } from '@nextui-org/react'
import BasePage from '@renderer/components/base/base-page'
import { MdDeleteForever } from 'react-icons/md'
import SettingCard from '@renderer/components/base/base-setting-card'
import SettingItem from '@renderer/components/base/base-setting-item'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { restartCore } from '@renderer/utils/ipc'
import React, { Key, ReactNode, useState } from 'react'

const DNS: React.FC = () => {
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()
  const { appConfig, patchAppConfig } = useAppConfig()
  const { nameserverPolicy, useNameserverPolicy } = appConfig || {}
  const { dns, hosts } = controledMihomoConfig || {}
  const {
    ipv6 = false,
    'fake-ip-range': fakeIPRange = '198.18.0.1/16',
    'fake-ip-filter': fakeIPFilter = [
      '*',
      '+.lan',
      '+.local',
      'time.*.com',
      'ntp.*.com',
      '+.market.xiaomi.com'
    ],
    'enhanced-mode': enhancedMode = 'fake-ip',
    'use-hosts': useHosts = false,
    'use-system-hosts': useSystemHosts = false,
    'respect-rules': respectRules = false,
    'default-nameserver': defaultNameserver = ['tls://223.5.5.5'],
    nameserver = ['https://doh.pub/dns-query', 'https://dns.alidns.com/dns-query'],
    'proxy-server-nameserver': proxyServerNameserver = [
      'https://doh.pub/dns-query',
      'https://dns.alidns.com/dns-query'
    ],
    'direct-nameserver': directNameserver = []
  } = dns || {}
  const [changed, setChanged] = useState(false)
  const [values, originSetValues] = useState({
    ipv6,
    useHosts,
    enhancedMode,
    fakeIPRange,
    fakeIPFilter,
    useSystemHosts,
    respectRules,
    defaultNameserver,
    nameserver,
    proxyServerNameserver,
    directNameserver,
    useNameserverPolicy,
    nameserverPolicy: Object.entries(nameserverPolicy || {}).map(([domain, value]) => ({
      domain,
      value
    })),
    hosts: Object.entries(hosts || {}).map(([domain, value]) => ({ domain, value }))
  })

  const setValues = (v: typeof values): void => {
    originSetValues(v)
    setChanged(true)
  }

  const handleListChange = (type: string, value: string, index: number): void => {
    const list = [...values[type]]
    if (value.trim()) {
      if (index < list.length) {
        list[index] = value
      } else {
        list.push(value)
      }
    } else {
      list.splice(index, 1)
    }
    setValues({ ...values, [type]: list })
  }

  const renderListInputs = (type: string, placeholder: string): ReactNode => {
    const currentItems = values[type]
    const showNewLine = currentItems.every((item: string) => item.trim() !== '')

    return [...currentItems, ...(showNewLine ? [''] : [])].map((item, index) => (
      <div key={index} className="mt-2 flex">
        <Input
          fullWidth
          size="sm"
          placeholder={placeholder}
          value={typeof item === 'string' ? item : item.domain}
          onValueChange={(v) => handleListChange(type, v, index)}
        />
        {index < values[type].length && (
          <Button
            className="ml-2"
            size="sm"
            variant="flat"
            color="warning"
            onClick={() => handleListChange(type, '', index)}
          >
            <MdDeleteForever className="text-lg" />
          </Button>
        )}
      </div>
    ))
  }

  const handleSubkeyChange = (type: string, domain: string, value: string, index: number): void => {
    const list = [...values[type]]
    const processedValue = value.includes(',')
      ? value.split(',').map((s: string) => s.trim())
      : value.trim()
    if (domain || processedValue) list[index] = { domain: domain.trim(), value: processedValue }
    else list.splice(index, 1)
    setValues({ ...values, [type]: list })
  }

  const onSave = async (patch: Partial<IMihomoConfig>): Promise<void> => {
    await patchAppConfig({
      nameserverPolicy: Object.fromEntries(
        values.nameserverPolicy.map(({ domain, value }) => [domain, value])
      ),
      useNameserverPolicy: values.useNameserverPolicy
    })
    try {
      setChanged(false)
      await patchControledMihomoConfig(patch)
      await restartCore()
    } catch (e) {
      alert(e)
    }
  }

  return (
    <BasePage
      title="DNS 设置"
      header={
        changed && (
          <Button
            size="sm"
            className="app-nodrag"
            color="primary"
            onPress={() => {
              const hostsObject = Object.fromEntries(
                values.hosts.map(({ domain, value }) => [domain, value])
              )
              const dnsConfig = {
                ipv6: values.ipv6,
                'fake-ip-range': values.fakeIPRange,
                'fake-ip-filter': values.fakeIPFilter,
                'enhanced-mode': values.enhancedMode,
                'use-hosts': values.useHosts,
                'use-system-hosts': values.useSystemHosts,
                'respect-rules': values.respectRules,
                'default-nameserver': values.defaultNameserver,
                nameserver: values.nameserver,
                'proxy-server-nameserver': values.proxyServerNameserver,
                'direct-nameserver': values.directNameserver,
                fallback: undefined,
                'fallback-filter': undefined
              }
              if (values.useNameserverPolicy) {
                dnsConfig['nameserver-policy'] = Object.fromEntries(
                  values.nameserverPolicy.map(({ domain, value }) => [domain, value])
                )
              }
              onSave({
                dns: dnsConfig,
                hosts: hostsObject
              })
            }}
          >
            保存
          </Button>
        )
      }
    >
      <SettingCard>
        <SettingItem title="域名映射模式" divider>
          <Tabs
            size="sm"
            color="primary"
            selectedKey={values.enhancedMode}
            onSelectionChange={(key: Key) => setValues({ ...values, enhancedMode: key as DnsMode })}
          >
            <Tab key="fake-ip" title="虚假 IP" />
            <Tab key="redir-host" title="真实 IP" />
            <Tab key="normal" title="取消映射" />
          </Tabs>
        </SettingItem>
        {values.enhancedMode === 'fake-ip' ? (
          <>
            <SettingItem title="回应范围" divider>
              <Input
                size="sm"
                className="w-[50%]"
                value={values.fakeIPRange}
                onValueChange={(v) => {
                  setValues({ ...values, fakeIPRange: v })
                }}
              />
            </SettingItem>
            <div className="flex flex-col items-stretch">
              <h3>真实 IP 回应</h3>
              {renderListInputs('fakeIPFilter', '例：+.lan')}
            </div>
            <Divider className="my-2" />
          </>
        ) : null}
        <SettingItem title="IPv6" divider>
          <Switch
            size="sm"
            isSelected={values.ipv6}
            onValueChange={(v) => {
              setValues({ ...values, ipv6: v })
            }}
          />
        </SettingItem>
        <SettingItem title="遵守规则" divider>
          <Switch
            size="sm"
            isSelected={values.respectRules}
            onValueChange={(v) => {
              setValues({ ...values, respectRules: v })
            }}
          />
        </SettingItem>

        <div className="flex flex-col items-stretch">
          <h3>DNS 服务器域名解析</h3>
          {renderListInputs('defaultNameserver', '例：223.5.5.5，仅支持 IP')}
        </div>
        <Divider className="my-2" />
        <div className="flex flex-col items-stretch">
          <h3>代理服务器域名解析</h3>
          {renderListInputs('proxyServerNameserver', '例：tls://dns.alidns.com')}
        </div>
        <Divider className="my-2" />
        <div className="flex flex-col items-stretch">
          <h3>默认解析服务器</h3>
          {renderListInputs('nameserver', '例：tls://dns.alidns.com')}
        </div>
        <Divider className="my-2" />
        <div className="flex flex-col items-stretch">
          <h3>直连解析服务器</h3>
          {renderListInputs('directNameserver', '例：tls://dns.alidns.com')}
        </div>
        <Divider className="my-2" />
        <SettingItem title="覆盖DNS策略" divider>
          <Switch
            size="sm"
            isSelected={values.useNameserverPolicy}
            onValueChange={(v) => {
              setValues({ ...values, useNameserverPolicy: v })
            }}
          />
        </SettingItem>
        {values.useNameserverPolicy && (
          <div className="flex flex-col items-stretch">
            <div className="flex flex-col items-stretch">
              <h3 className="mb-2"></h3>
              {[...values.nameserverPolicy, { domain: '', value: '' }].map(
                ({ domain, value }, index) => (
                  <div key={index} className="flex mb-2">
                    <div className="flex-[4]">
                      <Input
                        size="sm"
                        fullWidth
                        placeholder="域名"
                        value={domain}
                        onValueChange={(v) =>
                          handleSubkeyChange(
                            'nameserverPolicy',
                            v,
                            Array.isArray(value) ? value.join(',') : value,
                            index
                          )
                        }
                      />
                    </div>
                    <span className="mx-2">:</span>
                    <div className="flex-[6] flex">
                      <Input
                        size="sm"
                        fullWidth
                        placeholder="DNS 服务器"
                        value={Array.isArray(value) ? value.join(',') : value}
                        onValueChange={(v) =>
                          handleSubkeyChange('nameserverPolicy', domain, v, index)
                        }
                      />
                      {index < values.nameserverPolicy.length && (
                        <Button
                          size="sm"
                          color="warning"
                          variant="flat"
                          className="ml-2"
                          onClick={() => handleSubkeyChange('nameserverPolicy', '', '', index)}
                        >
                          <MdDeleteForever className="text-lg" />
                        </Button>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        )}
        <SettingItem title="使用系统 Hosts" divider>
          <Switch
            size="sm"
            isSelected={values.useSystemHosts}
            onValueChange={(v) => {
              setValues({ ...values, useSystemHosts: v })
            }}
          />
        </SettingItem>
        <SettingItem title="自定义 Hosts">
          <Switch
            size="sm"
            isSelected={values.useHosts}
            onValueChange={(v) => {
              setValues({ ...values, useHosts: v })
            }}
          />
        </SettingItem>
        {values.useHosts && (
          <div className="flex flex-col items-stretch">
            <h3 className="mb-2"></h3>
            {[...values.hosts, { domain: '', value: '' }].map(({ domain, value }, index) => (
              <div key={index} className="flex mb-2">
                <div className="flex-[4]">
                  <Input
                    size="sm"
                    fullWidth
                    placeholder="域名"
                    value={domain}
                    onValueChange={(v) =>
                      handleSubkeyChange(
                        'hosts',
                        v,
                        Array.isArray(value) ? value.join(',') : value,
                        index
                      )
                    }
                  />
                </div>
                <span className="mx-2">:</span>
                <div className="flex-[6] flex">
                  <Input
                    size="sm"
                    fullWidth
                    placeholder="域名或 IP"
                    value={Array.isArray(value) ? value.join(',') : value}
                    onValueChange={(v) => handleSubkeyChange('hosts', domain, v, index)}
                  />
                  {index < values.hosts.length && (
                    <Button
                      size="sm"
                      color="warning"
                      variant="flat"
                      className="ml-2"
                      onClick={() => handleSubkeyChange('hosts', '', '', index)}
                    >
                      <MdDeleteForever className="text-lg" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SettingCard>
    </BasePage>
  )
}

export default DNS
