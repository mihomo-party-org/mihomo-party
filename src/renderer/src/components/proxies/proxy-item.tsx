import { Button, Card, CardBody } from '@heroui/react'
import { mihomoUnfixedProxy } from '@renderer/utils/ipc'
import React, { useMemo, useState } from 'react'
import { FaMapPin } from 'react-icons/fa6'
import { useTranslation } from 'react-i18next'

interface Props {
  mutateProxies: () => void
  onProxyDelay: (proxy: string, url?: string) => Promise<IMihomoDelay>
  proxyDisplayMode: 'simple' | 'full'
  proxy: IMihomoProxy | IMihomoGroup
  group: IMihomoMixedGroup
  onSelect: (group: string, proxy: string) => void
  selected: boolean
}

const ProxyItem: React.FC<Props> = (props) => {
  const { t } = useTranslation()
  const { mutateProxies, proxyDisplayMode, group, proxy, selected, onSelect, onProxyDelay } = props

  const delay = useMemo(() => {
    if (proxy.history.length > 0) {
      return proxy.history[proxy.history.length - 1].delay
    }
    return -1
  }, [proxy])

  const [loading, setLoading] = useState(false)
  function delayColor(delay: number): 'primary' | 'success' | 'warning' | 'danger' {
    if (delay === -1) return 'primary'
    if (delay === 0) return 'danger'
    if (delay < 500) return 'success'
    return 'warning'
  }

  function delayText(delay: number): string {
    if (delay === -1) return t('proxies.delay.test')
    if (delay === 0) return t('proxies.delay.timeout')
    return delay.toString()
  }

  const onDelay = (): void => {
    setLoading(true)
    onProxyDelay(proxy.name, group.testUrl).finally(() => {
      mutateProxies()
      setLoading(false)
    })
  }

  const fixed = group.fixed && group.fixed === proxy.name

  return (
    <Card
      as="div"
      onPress={() => onSelect(group.name, proxy.name)}
      isPressable
      fullWidth
      shadow="sm"
      className={`${
        fixed 
          ? 'bg-secondary/30 border-r-2 border-r-secondary border-l-2 border-l-secondary' 
          : selected 
            ? 'bg-primary/30 border-r-2 border-r-primary border-l-2 border-l-primary' 
            : 'bg-content2'
      }`}
      radius="sm"
    >
    <CardBody className="p-1">
      {proxyDisplayMode === 'full' ? (
          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center pl-1">
              <div className="text-ellipsis overflow-hidden whitespace-nowrap">
                <div className="flag-emoji inline" title={proxy.name}>
                  {proxy.name}
                </div>
              </div>
              {fixed && (
                <Button
                  isIconOnly
                    title={t('proxies.unpin')}
                  color="danger"
                  onPress={async () => {
                    await mihomoUnfixedProxy(group.name)
                    mutateProxies()
                  }}
                  variant="light"
                  className="h-[20px] p-0 text-sm"
                >
                  <FaMapPin className="text-md le" />
                </Button>
              )}
            </div>
            <div className="flex justify-between items-center pl-1">
              <div className="flex gap-1 items-center">
                <div className="text-foreground-400 text-xs bg-default-100 px-1 rounded-md">
                  {proxy.type}
                </div>
                {['tfo', 'udp', 'xudp', 'mptcp', 'smux'].map(protocol => 
                  proxy[protocol as keyof IMihomoProxy] && (
                    <div key={protocol} className="text-foreground-400 text-xs bg-default-100 px-1 rounded-md">
                      {protocol}
                    </div>
                  )
                )}
              </div>
              <Button
                isIconOnly
                title={proxy.type}
                isLoading={loading}
                color={delayColor(delay)}
                onPress={onDelay}
                variant="light"
                className="h-full text-sm ml-auto -mt-0.5 px-2 relative w-min whitespace-nowrap"
              >
                <div className="w-full h-full flex items-center justify-end">
                  {delayText(delay)}
                </div>
              </Button>
            </div>
          </div>
        ) : (
        <div className="flex justify-between items-center pl-1">
          <div className="text-ellipsis overflow-hidden whitespace-nowrap">
            <div className="flag-emoji inline" title={proxy.name}>
              {proxy.name}
            </div>
          </div>
          <div className="flex justify-end">
            {fixed && (
              <Button
                isIconOnly
                    title={t('proxies.unpin')}
                color="danger"
                onPress={async () => {
                  await mihomoUnfixedProxy(group.name)
                  mutateProxies()
                }}
                variant="light"
                className="h-[20px] p-0 text-sm"
              >
                <FaMapPin className="text-md le" />
              </Button>
            )}
            <Button
              isIconOnly
              title={proxy.type}
              isLoading={loading}
              color={delayColor(delay)}
              onPress={onDelay}
              variant="light"
              className="h-[24px] text-sm px-2 relative w-min whitespace-nowrap"
            >
              <div className="w-full h-full flex items-center justify-end">
                {delayText(delay)}
              </div>
            </Button>
          </div>
        </div>
      )}
      </CardBody>
    </Card>
  )
}

export default ProxyItem