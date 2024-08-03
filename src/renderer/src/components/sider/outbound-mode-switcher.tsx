import { Tabs, Tab } from '@nextui-org/react'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { patchMihomoConfig } from '@renderer/utils/ipc'
import { Key } from 'react'

const OutboundModeSwitcher: React.FC = () => {
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig(true)
  const { mode } = controledMihomoConfig || {}

  const onChangeMode = async (mode: OutboundMode): Promise<void> => {
    await patchControledMihomoConfig({ mode })
    await patchMihomoConfig({ mode })
  }

  return (
    <Tabs
      fullWidth
      color="primary"
      selectedKey={mode}
      onSelectionChange={(key: Key) => onChangeMode(key as OutboundMode)}
    >
      <Tab
        className={`select-none ${mode === 'rule' ? 'font-bold' : ''}`}
        key="rule"
        title="规则"
      />
      <Tab
        className={`select-none ${mode === 'global' ? 'font-bold' : ''}`}
        key="global"
        title="全局"
      />
      <Tab
        className={`select-none ${mode === 'direct' ? 'font-bold' : ''}`}
        key="direct"
        title="直连"
      />
    </Tabs>
  )
}

export default OutboundModeSwitcher
