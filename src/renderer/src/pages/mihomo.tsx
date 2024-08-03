import { Input, Select, SelectItem, Switch } from '@nextui-org/react'
import BasePage from '@renderer/components/base/base-page'
import SettingCard from '@renderer/components/base/base-setting-card'
import SettingItem from '@renderer/components/base/base-setting-item'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { patchMihomoConfig } from '@renderer/utils/ipc'
import React from 'react'

const Mihomo: React.FC = () => {
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()
  const {
    ipv6,
    'log-level': level = 'info',
    'allow-lan': lan,
    'mixed-port': mixedPort = 7890
  } = controledMihomoConfig || {}

  const onChange = async (patch: Partial<IMihomoConfig>): Promise<void> => {
    await patchControledMihomoConfig(patch)
    await patchMihomoConfig(patch)
  }

  return (
    <BasePage title="内核设置">
      <SettingCard>
        <SettingItem title="混合端口" divider>
          <Input
            size="sm"
            type="number"
            className="w-[100px]"
            value={mixedPort.toString()}
            max={65535}
            min={0}
            onValueChange={(v) => {
              onChange({ 'mixed-port': parseInt(v) })
            }}
          />
        </SettingItem>
        <SettingItem title="IPv6" divider>
          <Switch
            size="sm"
            isSelected={ipv6}
            onValueChange={(v) => {
              onChange({ ipv6: v })
            }}
          />
        </SettingItem>
        <SettingItem title="允许局域网连接" divider>
          <Switch
            size="sm"
            isSelected={lan}
            onValueChange={(v) => {
              onChange({ 'allow-lan': v })
            }}
          />
        </SettingItem>
        <SettingItem title="日志等级">
          <Select
            className="w-[100px]"
            size="sm"
            selectedKeys={new Set([level])}
            onSelectionChange={(v) => {
              onChange({ 'log-level': v.currentKey as LogLevel })
            }}
          >
            <SelectItem key="silent">静默</SelectItem>
            <SelectItem key="info">信息</SelectItem>
            <SelectItem key="warning">警告</SelectItem>
            <SelectItem key="error">错误</SelectItem>
            <SelectItem key="debug">调试</SelectItem>
          </Select>
        </SettingItem>
      </SettingCard>
    </BasePage>
  )
}

export default Mihomo
