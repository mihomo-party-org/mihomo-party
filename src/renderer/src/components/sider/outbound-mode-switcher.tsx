import { Tabs, Tab } from '@nextui-org/react'
import { Key, useState } from 'react'

export default function OutboundModeSwitcher(): JSX.Element {
  const [mode, setMode] = useState<OutboundMode>('rule')
  return (
    <Tabs
      fullWidth
      color="primary"
      selectedKey={mode}
      onSelectionChange={(key: Key) => setMode(key as OutboundMode)}
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
