import { Button, Divider, Input, Switch } from '@nextui-org/react'
import BasePage from '@renderer/components/base/base-page'
import SettingCard from '@renderer/components/base/base-setting-card'
import SettingItem from '@renderer/components/base/base-setting-item'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { restartCore } from '@renderer/utils/ipc'
import React, { useState } from 'react'
import { MdDeleteForever } from 'react-icons/md'

const Sniffer: React.FC = () => {
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()
  const { sniffer } = controledMihomoConfig || {}
  const {
    'parse-pure-ip': parsePureIP = true,
    'force-dns-mapping': forceDNSMapping = true,
    'override-destination': overrideDestination = false,
    sniff = {
      HTTP: { ports: [80, 443], 'override-destination': false },
      TLS: { ports: [443] },
      QUIC: { ports: [443] }
    },
    'skip-domain': skipDomain = ['+.push.apple.com'],
    'force-domain': forceDomain = []
  } = sniffer || {}
  const [changed, setChanged] = useState(false)
  const [values, originSetValues] = useState({
    parsePureIP,
    forceDNSMapping,
    overrideDestination,
    sniff,
    skipDomain,
    forceDomain
  })
  const setValues = (v: typeof values): void => {
    originSetValues(v)
    setChanged(true)
  }

  const onSave = async (patch: Partial<IMihomoConfig>): Promise<void> => {
    try {
      setChanged(false)
      await patchControledMihomoConfig(patch)
      await restartCore()
    } catch (e) {
      alert(e)
    }
  }

  const handleSniffPortChange = (protocol: keyof typeof sniff, value: string): void => {
    setValues({
      ...values,
      sniff: {
        ...values.sniff,
        [protocol]: {
          ...values.sniff[protocol],
          ports: value.split(',').map((port) => port.trim())
        }
      }
    })
  }
  const handleDomainChange = (type: string, value: string, index: number): void => {
    const newDomains = [...values[type]]
    if (index === newDomains.length) {
      if (value.trim() !== '') {
        newDomains.push(value)
      }
    } else {
      if (value.trim() === '') {
        newDomains.splice(index, 1)
      } else {
        newDomains[index] = value
      }
    }
    setValues({ ...values, [type]: newDomains })
  }

  return (
    <BasePage
      title="域名嗅探设置"
      header={
        changed && (
          <Button
            size="sm"
            className="app-nodrag"
            color="primary"
            onPress={() =>
              onSave({
                sniffer: {
                  'parse-pure-ip': values.parsePureIP,
                  'force-dns-mapping': values.forceDNSMapping,
                  'override-destination': values.overrideDestination,
                  sniff: values.sniff,
                  'skip-domain': values.skipDomain,
                  'force-domain': values.forceDomain
                }
              })
            }
          >
            保存
          </Button>
        )
      }
    >
      <SettingCard>
        <SettingItem title="覆盖连接地址" divider>
          <Switch
            size="sm"
            isSelected={values.overrideDestination}
            onValueChange={(v) => {
              setValues({
                ...values,
                overrideDestination: v,
                sniff: {
                  ...values.sniff,
                  HTTP: {
                    ...values.sniff.HTTP,
                    'override-destination': v,
                    ports: values.sniff.HTTP?.ports || [80, 443]
                  }
                }
              })
            }}
          />
        </SettingItem>
        <SettingItem title="对真实 IP 映射嗅探" divider>
          <Switch
            size="sm"
            isSelected={values.forceDNSMapping}
            onValueChange={(v) => {
              setValues({ ...values, forceDNSMapping: v })
            }}
          />
        </SettingItem>
        <SettingItem title="对未映射 IP 地址嗅探" divider>
          <Switch
            size="sm"
            isSelected={values.parsePureIP}
            onValueChange={(v) => {
              setValues({ ...values, parsePureIP: v })
            }}
          />
        </SettingItem>
        <SettingItem title="HTTP 端口嗅探" divider>
          <Input
            size="sm"
            className="w-[50%]"
            value={values.sniff.HTTP?.ports.join(',')}
            onValueChange={(v) => handleSniffPortChange('HTTP', v)}
          />
        </SettingItem>
        <SettingItem title="TLS 端口嗅探" divider>
          <Input
            size="sm"
            className="w-[50%]"
            value={values.sniff.TLS?.ports.join(',')}
            onValueChange={(v) => handleSniffPortChange('TLS', v)}
          />
        </SettingItem>
        <SettingItem title="QUIC 端口嗅探" divider>
          <Input
            size="sm"
            className="w-[50%]"
            value={values.sniff.QUIC?.ports.join(',')}
            onValueChange={(v) => handleSniffPortChange('QUIC', v)}
          />
        </SettingItem>
        <div className="flex flex-col items-stretch">
          <h3>跳过嗅探域名</h3>
          {[...values.skipDomain, ''].map((d, index) => (
            <div key={index} className="flex mt-2">
              <Input
                size="sm"
                fullWidth
                placeholder="例: push.apple.com"
                value={d}
                onValueChange={(v) => handleDomainChange('skipDomain', v, index)}
              />
              {index < values.skipDomain.length && (
                <Button
                  size="sm"
                  color="warning"
                  variant="flat"
                  className="ml-2"
                  onClick={() => handleDomainChange('skipDomain', '', index)}
                >
                  <MdDeleteForever className="text-lg" />
                </Button>
              )}
            </div>
          ))}
        </div>
        <Divider className="my-2" />
        <div className="flex flex-col items-stretch">
          <h3 className="mb-2">强制嗅探域名</h3>
          {[...values.forceDomain, ''].map((d, index) => (
            <div key={index} className="flex mb-2">
              <Input
                size="sm"
                fullWidth
                placeholder="例: v2ex.com"
                value={d}
                onValueChange={(v) => handleDomainChange('forceDomain', v, index)}
              />
              {index < values.forceDomain.length && (
                <Button
                  size="sm"
                  color="warning"
                  variant="flat"
                  className="ml-2"
                  onClick={() => handleDomainChange('forceDomain', '', index)}
                >
                  <MdDeleteForever className="text-lg" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </SettingCard>
    </BasePage>
  )
}

export default Sniffer
