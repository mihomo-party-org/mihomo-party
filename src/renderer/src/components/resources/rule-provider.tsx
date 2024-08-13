import { mihomoRuleProviders, mihomoUpdateRuleProviders } from '@renderer/utils/ipc'
import { Fragment, useMemo, useState } from 'react'
import useSWR from 'swr'
import SettingCard from '../base/base-setting-card'
import SettingItem from '../base/base-setting-item'
import { Button, Chip } from '@nextui-org/react'
import { IoMdRefresh } from 'react-icons/io'
import dayjs from 'dayjs'

const RuleProvider: React.FC = () => {
  const { data, mutate } = useSWR('mihomoRuleProviders', mihomoRuleProviders)
  const providers = useMemo(() => {
    if (!data) return []
    return Object.keys(data.providers).map((key) => data.providers[key])
  }, [data])
  const [updating, setUpdating] = useState(Array(providers.length).fill(false))

  const onUpdate = async (name: string, index: number): Promise<void> => {
    setUpdating((prev) => {
      prev[index] = true
      return [...prev]
    })
    try {
      await mihomoUpdateRuleProviders(name)
      mutate()
    } catch (e) {
      alert(e)
    } finally {
      setUpdating((prev) => {
        prev[index] = false
        return [...prev]
      })
    }
  }

  if (!providers.length) {
    return null
  }

  return (
    <SettingCard>
      <SettingItem title="规则集合" divider>
        <Button
          size="sm"
          color="primary"
          onPress={() => {
            providers.forEach((provider, index) => {
              onUpdate(provider.name, index)
            })
          }}
        >
          更新全部
        </Button>
      </SettingItem>
      {providers.map((provider, index) => {
        return (
          <Fragment key={provider.name}>
            <SettingItem
              title={provider.name}
              actions={
                <Chip className="ml-2" size="sm">
                  {provider.ruleCount}
                </Chip>
              }
            >
              {
                <div className="flex h-[32px] leading-[32px] text-default-500">
                  <div>{dayjs(provider.updatedAt).fromNow()}</div>
                  <Button
                    isIconOnly
                    className="ml-2"
                    size="sm"
                    onPress={() => {
                      onUpdate(provider.name, index)
                    }}
                  >
                    <IoMdRefresh className={`text-lg ${updating[index] ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              }
            </SettingItem>
            <SettingItem
              title={<div className="text-default-500">{provider.format}</div>}
              divider={index !== providers.length - 1}
            >
              <div className="h-[32px] leading-[32px] text-default-500">
                {provider.vehicleType}::{provider.behavior}
              </div>
            </SettingItem>
          </Fragment>
        )
      })}
    </SettingCard>
  )
}

export default RuleProvider
