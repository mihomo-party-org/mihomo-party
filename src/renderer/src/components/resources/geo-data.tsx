import { Button, Input, Switch, Tab, Tabs } from '@heroui/react'
import SettingCard from '@renderer/components/base/base-setting-card'
import SettingItem from '@renderer/components/base/base-setting-item'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { mihomoUpgradeGeo } from '@renderer/utils/ipc'
import { useState } from 'react'
import { IoMdRefresh } from 'react-icons/io'
import { useTranslation } from 'react-i18next'

const GeoData: React.FC = () => {
  const { t } = useTranslation()
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()
  const {
    'geox-url': geoxUrl = {
      geoip: 'https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geoip-lite.dat',
      geosite: 'https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geosite.dat',
      mmdb: 'https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geoip.metadb',
      asn: 'https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/GeoLite2-ASN.mmdb'
    },
    'geodata-mode': geoMode = false,
    'geo-auto-update': geoAutoUpdate = false,
    'geo-update-interval': geoUpdateInterval = 24
  } = controledMihomoConfig || {}
  const [geoipInput, setGeoIpInput] = useState(geoxUrl.geoip)
  const [geositeInput, setGeositeInput] = useState(geoxUrl.geosite)
  const [mmdbInput, setMmdbInput] = useState(geoxUrl.mmdb)
  const [asnInput, setAsnInput] = useState(geoxUrl.asn)
  const [updating, setUpdating] = useState(false)

  return (
    <SettingCard>
      <SettingItem title={t('resources.geoData.geoip')} divider>
        <div className="flex w-[70%]">
          {geoipInput !== geoxUrl.geoip && (
            <Button
              size="sm"
              color="primary"
              className="mr-2"
              onPress={() => {
                patchControledMihomoConfig({ 'geox-url': { ...geoxUrl, geoip: geoipInput } })
              }}
            >
              {t('common.confirm')}
            </Button>
          )}
          <Input size="sm" value={geoipInput} onValueChange={setGeoIpInput} />
        </div>
      </SettingItem>
      <SettingItem title={t('resources.geoData.geosite')} divider>
        <div className="flex w-[70%]">
          {geositeInput !== geoxUrl.geosite && (
            <Button
              size="sm"
              color="primary"
              className="mr-2"
              onPress={() => {
                patchControledMihomoConfig({ 'geox-url': { ...geoxUrl, geosite: geositeInput } })
              }}
            >
              {t('common.confirm')}
            </Button>
          )}
          <Input size="sm" value={geositeInput} onValueChange={setGeositeInput} />
        </div>
      </SettingItem>
      <SettingItem title={t('resources.geoData.mmdb')} divider>
        <div className="flex w-[70%]">
          {mmdbInput !== geoxUrl.mmdb && (
            <Button
              size="sm"
              color="primary"
              className="mr-2"
              onPress={() => {
                patchControledMihomoConfig({ 'geox-url': { ...geoxUrl, mmdb: mmdbInput } })
              }}
            >
              {t('common.confirm')}
            </Button>
          )}
          <Input size="sm" value={mmdbInput} onValueChange={setMmdbInput} />
        </div>
      </SettingItem>
      <SettingItem title={t('resources.geoData.asn')} divider>
        <div className="flex w-[70%]">
          {asnInput !== geoxUrl.asn && (
            <Button
              size="sm"
              color="primary"
              className="mr-2"
              onPress={() => {
                patchControledMihomoConfig({ 'geox-url': { ...geoxUrl, asn: asnInput } })
              }}
            >
              {t('common.confirm')}
            </Button>
          )}
          <Input size="sm" value={asnInput} onValueChange={setAsnInput} />
        </div>
      </SettingItem>
      <SettingItem title={t('resources.geoData.mode')} divider>
        <Tabs
          size="sm"
          color="primary"
          selectedKey={geoMode ? 'dat' : 'db'}
          onSelectionChange={(key) => {
            patchControledMihomoConfig({ 'geodata-mode': key === 'dat' })
          }}
        >
          <Tab key="db" title="db" />
          <Tab key="dat" title="dat" />
        </Tabs>
      </SettingItem>
      <SettingItem
        title={t('resources.geoData.autoUpdate')}
        actions={
          <Button
            size="sm"
            isIconOnly
            variant="light"
            onPress={async () => {
              setUpdating(true)
              try {
                await mihomoUpgradeGeo()
                new Notification(t('resources.geoData.updateSuccess'))
              } catch (e) {
                alert(e)
              } finally {
                setUpdating(false)
              }
            }}
          >
            <IoMdRefresh className={`text-lg ${updating ? 'animate-spin' : ''}`} />
          </Button>
        }
        divider={geoAutoUpdate}
      >
        <Switch
          size="sm"
          isSelected={geoAutoUpdate}
          onValueChange={(v) => {
            patchControledMihomoConfig({ 'geo-auto-update': v })
          }}
        />
      </SettingItem>
      {geoAutoUpdate && (
        <SettingItem title={t('resources.geoData.updateInterval')}>
          <Input
            size="sm"
            type="number"
            className="w-[100px]"
            value={geoUpdateInterval.toString()}
            onValueChange={(v) => {
              patchControledMihomoConfig({ 'geo-update-interval': parseInt(v) })
            }}
          />
        </SettingItem>
      )}
    </SettingCard>
  )
}

export default GeoData
