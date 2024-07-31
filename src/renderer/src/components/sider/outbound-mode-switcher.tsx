import { Tabs, Tab } from '@nextui-org/react'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { Key } from 'react'

const OutboundModeSwitcher: React.FC = () => {
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()
  const { mode } = controledMihomoConfig || {}

  return (
    <Tabs
      fullWidth
      color="primary"
      selectedKey={mode}
      onSelectionChange={(key: Key) => patchControledMihomoConfig({ mode: key as OutboundMode })}
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
