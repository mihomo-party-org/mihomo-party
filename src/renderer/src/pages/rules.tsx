import BasePage from '@renderer/components/base/base-page'
import RuleItem from '@renderer/components/rules/rule-item'
import { Virtuoso } from 'react-virtuoso'
import { useMemo, useState } from 'react'
import { Divider, Input } from '@nextui-org/react'
import useSWR from 'swr'
import { mihomoRules } from '@renderer/utils/ipc'

const Rules: React.FC = () => {
  const { data: rules } = useSWR<IMihomoRulesInfo>('mihomoRules', mihomoRules)
  const [filter, setFilter] = useState('')

  const filteredRules = useMemo(() => {
    if (!rules) return []
    if (filter === '') return rules.rules
    return rules.rules.filter((rule) => {
      return (
        rule.payload.includes(filter) || rule.type.includes(filter) || rule.proxy.includes(filter)
      )
    })
  }, [rules, filter])

  return (
    <BasePage title="分流规则">
      <div className="sticky top-[50px] z-40">
        <div className="flex p-2">
          <Input
            variant="bordered"
            size="sm"
            value={filter}
            placeholder="筛选过滤"
            isClearable
            onValueChange={setFilter}
          />
        </div>
        <Divider />
      </div>
      <Virtuoso
        style={{ height: 'calc(100vh - 100px)', marginTop: '1px' }}
        data={filteredRules}
        itemContent={(i, rule) => (
          <RuleItem
            index={i}
            type={rule.type}
            payload={rule.payload}
            proxy={rule.proxy}
            size={rule.size}
          />
        )}
      />
    </BasePage>
  )
}

export default Rules
