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
    nameserver = ['https://doh.pub/dns-query', 'https://dns.alidns.com/dns-query'],
    'proxy-server-nameserver': proxyServerNameserver = []
  } = dns || {}

  const [values, setValues] = useState({
    ipv6,
    useHosts,
    enhancedMode,
    fakeIPRange,
    fakeIPFilter,
    useSystemHosts,
    respectRules,
    nameserver,
    proxyServerNameserver,
    useNameserverPolicy,
    nameserverPolicy: Object.entries(nameserverPolicy || {}).map(([domain, value]) => ({
      domain,
      value
    })),
    hosts: Object.entries(hosts || {}).map(([domain, value]) => ({ domain, value }))
  })

  const handleListChange = (type: string, value: string, index: number): void => {
    const list = [...values[type]]
    if (value.trim()) {
      if (index < list.length) {
        list[index] = value
      } else if (list.length < 4) {
        list.push(value)
      }
    } else {
      list.splice(index, 1)
    }
    setValues({ ...values, [type]: list.slice(0, 4) })
  }

  const renderListInputs = (type: string, placeholder: string): ReactNode => {
    const currentItems = values[type].slice(0, 4)
    const showNewLine = currentItems.length < 4 && currentItems.every((item) => item.trim() !== '')

    return [...currentItems, ...(showNewLine ? [''] : [])].slice(0, 4).map((item, index) => (
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
    await patchControledMihomoConfig(patch)
    await restartCore()
  }

  return (
    <BasePage
      title="DNS 设置"
      header={
        <Button
          size="sm"
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
              nameserver: values.nameserver,
              'proxy-server-nameserver': values.proxyServerNameserver,
              fallback: [],
              'fallback-filter': {}
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
            <Tab key="fake-ip" title="虚假IP" className="select-none" />
            <Tab key="redir-host" title="真实IP" className="select-none" />
            <Tab key="normal" title="取消映射" className="select-none" />
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
              <h3 className="select-none">真实IP回应</h3>
              {renderListInputs('fakeIPFilter', '例: +.lan')}
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
        <SettingItem title="连接遵守规则" divider>
          <Switch
            size="sm"
            isSelected={values.respectRules}
            onValueChange={(v) => {
              setValues({ ...values, respectRules: v })
            }}
          />
        </SettingItem>

        <div className="flex flex-col items-stretch">
          <h3 className="select-none">代理节点域名解析</h3>
          {renderListInputs('proxyServerNameserver', '例: tls://223.5.5.5')}
        </div>
        <Divider className="my-2" />
        <div className="flex flex-col items-stretch">
          <h3 className="select-none">DNS服务器</h3>
          {renderListInputs('nameserver', '例: tls://223.5.5.5')}
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
                    <span className="select-none mx-2">:</span>
                    <div className="flex-[6] flex">
                      <Input
                        size="sm"
                        fullWidth
                        placeholder="DNS服务器"
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
        <SettingItem title="使用系统hosts" divider>
          <Switch
            size="sm"
            isSelected={values.useSystemHosts}
            onValueChange={(v) => {
              setValues({ ...values, useSystemHosts: v })
            }}
          />
        </SettingItem>
        <SettingItem title="自定义hosts">
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
                <span className="select-none mx-2">:</span>
                <div className="flex-[6] flex">
                  <Input
                    size="sm"
                    fullWidth
                    placeholder="域名或IP"
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
