import BasePage from '@renderer/components/base/base-page'
import RuleItem from '@renderer/components/rules/rule-item'
import { Virtuoso } from 'react-virtuoso'
import { useMemo, useState } from 'react'
import { Input } from '@nextui-org/react'
import useSWR from 'swr'
import { mihomoRules } from '@renderer/utils/ipc'

const Rules: React.FC = () => {
  const { data: rules = { rules: [] } } = useSWR<IMihomoRulesInfo>('mihomoRules', mihomoRules, {
    refreshInterval: 5000
  })
  const [filter, setFilter] = useState('')

  const filteredRules = useMemo(() => {
    if (filter === '') return rules.rules
    return rules.rules.filter((rule) => {
      return (
        rule.payload.includes(filter) || rule.type.includes(filter) || rule.proxy.includes(filter)
      )
    })
  }, [rules, filter])

  return (
    <BasePage title="分流规则">
      <div className="sticky top-[48px] z-40 backdrop-blur bg-background/40 flex p-2">
        <Input
          variant="bordered"
          size="sm"
          value={filter}
          placeholder="筛选过滤"
          onValueChange={setFilter}
        />
      </div>
      <Virtuoso
        style={{ height: 'calc(100vh - 100px)' }}
        data={filteredRules}
        itemContent={(_, rule) => (
          <RuleItem type={rule.type} payload={rule.payload} proxy={rule.proxy} size={rule.size} />
        )}
      />
    </BasePage>
  )
}

export default Rules
