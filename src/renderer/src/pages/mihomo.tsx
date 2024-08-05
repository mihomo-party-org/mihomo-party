import { Button, Input, Select, SelectItem, Switch } from '@nextui-org/react'
import BasePage from '@renderer/components/base/base-page'
import SettingCard from '@renderer/components/base/base-setting-card'
import SettingItem from '@renderer/components/base/base-setting-item'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { patchMihomoConfig, restartCore } from '@renderer/utils/ipc'
import React, { useState } from 'react'

const CoreMap = {
  mihomo: '稳定版',
  'mihomo-alpha': '预览版'
}

const Mihomo: React.FC = () => {
  const { appConfig, patchAppConfig } = useAppConfig()
  const { core = 'mihomo' } = appConfig || {}
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()
  const {
    ipv6,
    'external-controller': externalController,
    secret,
    'log-level': level = 'info',
    'find-process-mode': mode = 'strict',
    'allow-lan': lan,
    'unified-delay': delay,
    'mixed-port': mixedPort = 7890
  } = controledMihomoConfig || {}

  const [mixedPortInput, setMixedPortInput] = useState(mixedPort)
  const [externalControllerInput, setExternalControllerInput] = useState(externalController)
  const [secretInput, setSecretInput] = useState(secret)

  const onChange = async (patch: Partial<IMihomoConfig>): Promise<void> => {
    await patchControledMihomoConfig(patch)
    await patchMihomoConfig(patch)
  }

  const onChangeNeedRestart = async (patch: Partial<IMihomoConfig>): Promise<void> => {
    await patchControledMihomoConfig(patch)
    await restartCore()
  }

  return (
    <BasePage title="内核设置">
      <SettingCard>
        <SettingItem title="内核版本" divider>
          <Select
            className="w-[100px]"
            size="sm"
            selectedKeys={new Set([core])}
            onSelectionChange={async (v) => {
              await patchAppConfig({ core: v.currentKey as 'mihomo' | 'mihomo-alpha' })
              restartCore().then(() => PubSub.publish('mihomo-core-changed'))
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
                onPress={() => {
                  onChangeNeedRestart({ 'mixed-port': mixedPortInput })
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
        <SettingItem title="外部控制" divider>
          <div className="flex">
            {externalControllerInput !== externalController && (
              <Button
                size="sm"
                color="primary"
                className="mr-2"
                onPress={() => {
                  onChangeNeedRestart({ 'external-controller': externalControllerInput })
                }}
              >
                确认
              </Button>
            )}

            <Input
              size="sm"
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
        <SettingItem title="使用RTT延迟测试" divider>
          <Switch
            size="sm"
            isSelected={delay}
            onValueChange={(v) => {
              onChange({ 'unified-delay': v })
            }}
          />
        </SettingItem>
        <SettingItem title="日志等级" divider>
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
        <SettingItem title="查找进程">
          <Select
            className="w-[100px]"
            size="sm"
            selectedKeys={new Set([mode])}
            onSelectionChange={(v) => {
              onChange({ 'find-process-mode': v.currentKey as FindProcessMode })
            }}
          >
            <SelectItem key="strict">自动</SelectItem>
            <SelectItem key="off">关闭</SelectItem>
            <SelectItem key="always">开启</SelectItem>
          </Select>
        </SettingItem>
      </SettingCard>
    </BasePage>
  )
}

export default Mihomo
