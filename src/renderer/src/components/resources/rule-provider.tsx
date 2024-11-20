import { mihomoRuleProviders, mihomoUpdateRuleProviders, mihomoRunRuleProviders } from '@renderer/utils/ipc'
import { getHash } from '@renderer/utils/hash'
import Viewer from './viewer'
import { Fragment, useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import SettingCard from '../base/base-setting-card'
import SettingItem from '../base/base-setting-item'
import { Button, Chip } from '@nextui-org/react'
import { IoMdRefresh } from 'react-icons/io'
import { CgLoadbarDoc } from 'react-icons/cg'
import dayjs from 'dayjs'

const RuleProvider: React.FC = () => {
  const [ShowProvider, setShowProvider] = useState(false)
  const [ShowPath, setShowPath] = useState('')
  const [ShowType, setShowType] = useState('')
  const [ShowFormat, setShowFormat] = useState('')

  const { data, mutate } = useSWR('mihomoRuleProviders', mihomoRuleProviders)
  const providers = useMemo(() => {
    if (!data) return []
    if (!data.providers) return []
    return Object.keys(data.providers).map((key) => data.providers[key])
  }, [data])
  const [updating, setUpdating] = useState(Array(providers.length).fill(false))

  useEffect(() => {
    const fetchProviderPath = async (name: string) => {
      try {
        const providers = await mihomoRunRuleProviders()
        const provider = providers[name]
        if (provider?.path) {
          setShowPath(provider.path)
        } else if (provider?.url) {
          setShowPath(`rules/` + getHash(provider.url))
        }
        setShowProvider(true)
      } catch (error) {
        setShowPath('')
      }
    }
    if (ShowPath != '') {
      fetchProviderPath(ShowPath)
    }
  }, [ShowProvider, ShowPath])

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
      {ShowProvider && <Viewer
        path={ShowPath}
        type={ShowType}
        format={ShowFormat}
        onClose={() => { setShowProvider(false); setShowPath(''); setShowType('') }}
      />}
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
      {providers.map((provider, index) => (
        <Fragment key={provider.name}>
          <SettingItem
            title={provider.name}
            actions={
              <Chip className="ml-2" size="sm">
                {provider.ruleCount}
              </Chip>
            }
          >
            <div className="flex h-[32px] leading-[32px] text-foreground-500">
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
              {provider.format !== "MrsRule" && (
                <Button
                  isIconOnly
                  className="ml-2"
                  size="sm"
                  onPress={() => {
                    setShowType(provider.vehicleType)
                    setShowFormat(provider.format)
                    setShowPath(provider.name)
                  }}
                >
                  <CgLoadbarDoc className={`text-lg`} />
                </Button>
              )}
            </div>
          </SettingItem>
          <SettingItem
            title={<div className="text-foreground-500">{provider.format}</div>}
            divider={index !== providers.length - 1}
          >
            <div className="h-[32px] leading-[32px] text-foreground-500">
              {provider.vehicleType}::{provider.behavior}
            </div>
          </SettingItem>
        </Fragment>
      ))}
    </SettingCard>
  )
}

export default RuleProvider
