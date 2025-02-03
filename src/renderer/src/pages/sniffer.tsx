import { Button, Divider, Input, Switch } from '@heroui/react'
import BasePage from '@renderer/components/base/base-page'
import SettingCard from '@renderer/components/base/base-setting-card'
import SettingItem from '@renderer/components/base/base-setting-item'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { restartCore } from '@renderer/utils/ipc'
import React, { ReactNode, useState } from 'react'
import { MdDeleteForever } from 'react-icons/md'
import { useTranslation } from 'react-i18next'

const Sniffer: React.FC = () => {
  const { t } = useTranslation()
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()
  const { sniffer } = controledMihomoConfig || {}
  const {
    'parse-pure-ip': parsePureIP = true,
    'force-dns-mapping': forceDNSMapping = true,
    'override-destination': overrideDestination = false,
    sniff = {
      HTTP: { ports: [80, 443], 'override-destination': false },
      TLS: { ports: [443] },
      QUIC: { ports: [] }
    },
    'skip-domain': skipDomain = ['+.push.apple.com'],
    'force-domain': forceDomain = [],
    'skip-dst-address': skipDstAddress = [
      '91.105.192.0/23',
      '91.108.4.0/22',
      '91.108.8.0/21',
      '91.108.16.0/21',
      '91.108.56.0/22',
      '95.161.64.0/20',
      '149.154.160.0/20',
      '185.76.151.0/24',
      '2001:67c:4e8::/48',
      '2001:b28:f23c::/47',
      '2001:b28:f23f::/48',
      '2a0a:f280:203::/48'
    ],
    'skip-src-address': skipSrcAddress = []
  } = sniffer || {}
  const [changed, setChanged] = useState(false)
  const [values, originSetValues] = useState({
    parsePureIP,
    forceDNSMapping,
    overrideDestination,
    sniff,
    skipDomain,
    forceDomain,
    skipDstAddress,
    skipSrcAddress
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
            onPress={() => handleListChange(type, '', index)}
          >
            <MdDeleteForever className="text-lg" />
          </Button>
        )}
      </div>
    ))
  }

  return (
    <BasePage
      title={t('sniffer.title')}
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
            {t('common.save')}
          </Button>
        )
      }
    >
      <SettingCard>
        <SettingItem title={t('sniffer.overrideDestination')} divider>
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
        <SettingItem title={t('sniffer.forceDNSMapping')} divider>
          <Switch
            size="sm"
            isSelected={values.forceDNSMapping}
            onValueChange={(v) => {
              setValues({ ...values, forceDNSMapping: v })
            }}
          />
        </SettingItem>
        <SettingItem title={t('sniffer.parsePureIP')} divider>
          <Switch
            size="sm"
            isSelected={values.parsePureIP}
            onValueChange={(v) => {
              setValues({ ...values, parsePureIP: v })
            }}
          />
        </SettingItem>
        <SettingItem title={t('sniffer.sniff.title')} divider>
          <Input
            size="sm"
            className="w-[50%]"
            placeholder={t('sniffer.sniff.ports.placeholder')}
            value={values.sniff.HTTP?.ports.join(',')}
            onValueChange={(v) => handleSniffPortChange('HTTP', v)}
          />
        </SettingItem>
        <SettingItem title={t('sniffer.sniff.tls')} divider>
          <Input
            size="sm"
            className="w-[50%]"
            placeholder={t('sniffer.sniff.ports.placeholder')}
            value={values.sniff.TLS?.ports.join(',')}
            onValueChange={(v) => handleSniffPortChange('TLS', v)}
          />
        </SettingItem>
        <SettingItem title={t('sniffer.sniff.quic')} divider>
          <Input
            size="sm"
            className="w-[50%]"
            placeholder={t('sniffer.sniff.ports.placeholder')}
            value={values.sniff.QUIC?.ports.join(',')}
            onValueChange={(v) => handleSniffPortChange('QUIC', v)}
          />
        </SettingItem>
        <div className="flex flex-col items-stretch">
          <h3>{t('sniffer.skipDomain.title')}</h3>
          {renderListInputs('skipDomain', t('sniffer.skipDomain.placeholder'))}
        </div>
        <Divider className="my-2" />
        <div className="flex flex-col items-stretch">
          <h3 className="mb-2">{t('sniffer.forceDomain.title')}</h3>
          {renderListInputs('forceDomain', t('sniffer.forceDomain.placeholder'))}
        </div>
        <Divider className="my-2" />
        <div className="flex flex-col items-stretch">
          <h3 className="mb-2">{t('sniffer.skipDstAddress.title')}</h3>
          {renderListInputs('skipDstAddress', t('sniffer.skipDstAddress.placeholder'))}
        </div>
        <Divider className="my-2" />
        <div className="flex flex-col items-stretch">
          <h3 className="mb-2">{t('sniffer.skipSrcAddress.title')}</h3>
          {renderListInputs('skipSrcAddress', t('sniffer.skipSrcAddress.placeholder'))}
        </div>
      </SettingCard>
    </BasePage>
  )
}

export default Sniffer
