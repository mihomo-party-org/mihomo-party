import BasePage from '@renderer/components/base/base-page'
import RuleItem from '@renderer/components/rules/rule-item'
import { Virtuoso } from 'react-virtuoso'
import { useMemo, useState } from 'react'
import { Divider, Input } from '@nextui-org/react'
import { useRules } from '@renderer/hooks/use-rules'
import { includesIgnoreCase } from '@renderer/utils/includes'

const Rules: React.FC = () => {
  const { rules } = useRules()
  const [filter, setFilter] = useState('')

  const filteredRules = useMemo(() => {
    if (!rules) return []
    if (filter === '') return rules.rules
    return rules.rules.filter((rule) => {
      return (
        includesIgnoreCase(rule.payload, filter) ||
        includesIgnoreCase(rule.type, filter) ||
        includesIgnoreCase(rule.proxy, filter)
      )
    })
  }, [rules, filter])

  return (
    <BasePage title="分流规则">
      <div className="sticky top-0 z-40">
        <div className="flex p-2">
          <Input
            size="sm"
            value={filter}
            placeholder="筛选过滤"
            isClearable
            onValueChange={setFilter}
          />
        </div>
        <Divider />
      </div>
      <div className="h-[calc(100vh-100px)] mt-[1px]">
        <Virtuoso
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
      </div>
    </BasePage>
  )
}

export default Rules
