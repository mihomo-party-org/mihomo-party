import React, { useState } from 'react'
import SettingCard from '../base/base-setting-card'
import SettingItem from '../base/base-setting-item'
import { Input, Select, SelectItem, Switch } from '@nextui-org/react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import debounce from '@renderer/utils/debounce'
import { patchControledMihomoConfig } from '@renderer/utils/ipc'

const MihomoConfig: React.FC = () => {
  const { appConfig, patchAppConfig } = useAppConfig()
  const {
    controlDns = true,
    controlSniff = true,
    delayTestTimeout,
    autoCloseConnection = true,
    delayTestUrl,
    userAgent,
    proxyCols = 'auto'
  } = appConfig || {}
  const [url, setUrl] = useState(delayTestUrl)
  const setUrlDebounce = debounce((v: string) => {
    patchAppConfig({ delayTestUrl: v })
  }, 500)
  const [ua, setUa] = useState(userAgent)
  const setUaDebounce = debounce((v: string) => {
    patchAppConfig({ userAgent: v })
  }, 500)
  return (
    <SettingCard>
      <SettingItem title="订阅拉取 UA" divider>
        <Input
          size="sm"
          className="w-[60%]"
          value={ua}
          placeholder="默认 clash.meta"
          onValueChange={(v) => {
            setUa(v)
            setUaDebounce(v)
          }}
        ></Input>
      </SettingItem>
      <SettingItem title="延迟测试地址" divider>
        <Input
          size="sm"
          className="w-[60%]"
          value={url}
          placeholder="默认https://www.gstatic.com/generate_204"
          onValueChange={(v) => {
            setUrl(v)
            setUrlDebounce(v)
          }}
        ></Input>
      </SettingItem>
      <SettingItem title="延迟测试超时时间" divider>
        <Input
          type="number"
          size="sm"
          className="w-[60%]"
          value={delayTestTimeout?.toString()}
          placeholder="默认5000"
          onValueChange={(v) => {
            patchAppConfig({ delayTestTimeout: parseInt(v) })
          }}
        />
      </SettingItem>
      <SettingItem title="代理节点展示列数" divider>
        <Select
          className="w-[150px]"
          size="sm"
          selectedKeys={new Set([proxyCols])}
          onSelectionChange={async (v) => {
            await patchAppConfig({ proxyCols: v.currentKey as 'auto' | '1' | '2' | '3' | '4' })
          }}
        >
          <SelectItem key="auto">自动</SelectItem>
          <SelectItem key="1">一列</SelectItem>
          <SelectItem key="2">两列</SelectItem>
          <SelectItem key="3">三列</SelectItem>
          <SelectItem key="4">四列</SelectItem>
        </Select>
      </SettingItem>
      <SettingItem title="接管DNS设置" divider>
        <Switch
          size="sm"
          isSelected={controlDns}
          onValueChange={async (v) => {
            await patchAppConfig({ controlDns: v })
            await patchControledMihomoConfig({})
          }}
        />
      </SettingItem>
      <SettingItem title="接管域名嗅探设置" divider>
        <Switch
          size="sm"
          isSelected={controlSniff}
          onValueChange={async (v) => {
            await patchAppConfig({ controlSniff: v })
            await patchControledMihomoConfig({})
          }}
        />
      </SettingItem>
      <SettingItem title="自动断开连接">
        <Switch
          size="sm"
          isSelected={autoCloseConnection}
          onValueChange={(v) => {
            patchAppConfig({ autoCloseConnection: v })
          }}
        />
      </SettingItem>
    </SettingCard>
  )
}

export default MihomoConfig
