import React from 'react'
import SettingCard from '../base/base-setting-card'
import SettingItem from '../base/base-setting-item'
import { RadioGroup, Radio } from '@nextui-org/react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
const titleMap = {
  sysproxyCardStatus: '系统代理',
  tunCardStatus: '虚拟网卡',
  profileCardStatus: '订阅管理',
  proxyCardStatus: '代理组',
  ruleCardStatus: '规则',
  resourceCardStatus: '外部资源',
  overrideCardStatus: '覆写',
  connectionCardStatus: '连接',
  mihomoCoreCardStatus: '内核',
  dnsCardStatus: 'DNS',
  sniffCardStatus: '域名嗅探',
  logCardStatus: '日志',
  substoreCardStatus: 'Sub-Store'
}
const SiderConfig: React.FC = () => {
  const { appConfig, patchAppConfig } = useAppConfig()
  const {
    sysproxyCardStatus = 'col-span-1',
    tunCardStatus = 'col-span-1',
    profileCardStatus = 'col-span-2',
    proxyCardStatus = 'col-span-1',
    ruleCardStatus = 'col-span-1',
    resourceCardStatus = 'col-span-1',
    overrideCardStatus = 'col-span-1',
    connectionCardStatus = 'col-span-2',
    mihomoCoreCardStatus = 'col-span-2',
    dnsCardStatus = 'col-span-1',
    sniffCardStatus = 'col-span-1',
    logCardStatus = 'col-span-1',
    substoreCardStatus = 'col-span-1'
  } = appConfig || {}

  const cardStatus = {
    sysproxyCardStatus,
    tunCardStatus,
    profileCardStatus,
    proxyCardStatus,
    ruleCardStatus,
    resourceCardStatus,
    overrideCardStatus,
    connectionCardStatus,
    mihomoCoreCardStatus,
    dnsCardStatus,
    sniffCardStatus,
    logCardStatus,
    substoreCardStatus
  }

  return (
    <SettingCard title="侧边栏设置">
      {Object.keys(cardStatus).map((key, index, array) => {
        return (
          <SettingItem title={titleMap[key]} key={key} divider={index !== array.length - 1}>
            <RadioGroup
              orientation="horizontal"
              value={cardStatus[key]}
              onValueChange={(v) => {
                patchAppConfig({ [key]: v as CardStatus })
              }}
            >
              <Radio value="col-span-2">大</Radio>
              <Radio value="col-span-1">小</Radio>
              <Radio value="hidden">隐藏</Radio>
            </RadioGroup>
          </SettingItem>
        )
      })}
    </SettingCard>
  )
}

export default SiderConfig
