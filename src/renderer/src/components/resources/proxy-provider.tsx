import { mihomoProxyProviders, mihomoUpdateProxyProviders } from '@renderer/utils/ipc'
import { useMemo, useState } from 'react'
import useSWR from 'swr'
import SettingCard from '../base/base-setting-card'
import SettingItem from '../base/base-setting-item'
import { Button } from '@nextui-org/react'
import { IoMdRefresh } from 'react-icons/io'
import dayjs from 'dayjs'
import { calcTraffic } from '@renderer/utils/calc'

const ProxyProvider: React.FC = () => {
  const { data, mutate } = useSWR('mihomoProxyProviders', mihomoProxyProviders)
  const providers = useMemo(() => {
    if (!data) return []
    return Object.keys(data.providers)
      .map((key) => data.providers[key])
      .filter((provider) => {
        console.log(provider)
        return 'subscriptionInfo' in provider
      })
  }, [data])
  const [updating, setUpdating] = useState(Array(providers.length).fill(false))
  return (
    <SettingCard>
      {providers.map((provider, index) => {
        return (
          <>
            <SettingItem
              title={provider.name}
              key={provider.name}
              divider={!provider.subscriptionInfo && index !== providers.length - 1}
            >
              {
                <div className="flex h-[32px] leading-[32px]">
                  <div>{dayjs(provider.updateAt).fromNow()}</div>
                  <Button
                    isIconOnly
                    className="ml-2"
                    size="sm"
                    onPress={() => {
                      setUpdating((prev) => {
                        prev[index] = true
                        return [...prev]
                      })
                      mihomoUpdateProxyProviders(provider.name).finally(() => {
                        setUpdating((prev) => {
                          prev[index] = false
                          return [...prev]
                        })
                        mutate()
                      })
                    }}
                  >
                    <IoMdRefresh className={`text-lg ${updating[index] ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              }
            </SettingItem>
            {provider.subscriptionInfo && (
              <SettingItem
                divider={index !== providers.length - 1}
                title={`${calcTraffic(
                  provider.subscriptionInfo.Upload + provider.subscriptionInfo.Download
                )}
                    /${calcTraffic(provider.subscriptionInfo.Total)}`}
                key={provider.name}
              >
                {provider.subscriptionInfo && (
                  <div className="flex h-[32px] leading-[32px]">
                    <div className="ml-2">
                      {dayjs(provider.subscriptionInfo.Expire).format('YYYY-MM-DD')}
                    </div>
                  </div>
                )}
              </SettingItem>
            )}
          </>
        )
      })}
    </SettingCard>
  )
}

export default ProxyProvider
