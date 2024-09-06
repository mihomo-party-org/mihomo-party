import { Button, Card, CardBody } from '@nextui-org/react'
import React, { useMemo, useState } from 'react'

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
    if (delay === -1) return '测试'
    if (delay === 0) return '超时'
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
      onPress={() => onSelect(group.name, proxy.name)}
      isPressable
      fullWidth
      shadow="sm"
      className={`${fixed ? 'bg-secondary/30' : selected ? 'bg-primary/30' : 'bg-content2'}`}
      radius="sm"
    >
      <CardBody className="p-2">
        <div className="flex justify-between items-center">
          <div className="text-ellipsis overflow-hidden whitespace-nowrap">
            <div className="flag-emoji inline" title={proxy.name}>
              {proxy.name}
            </div>
            {proxyDisplayMode === 'full' && (
              <div className="inline ml-2 text-default-500" title={proxy.type}>
                {proxy.type}
              </div>
            )}
          </div>
          <Button
            title={proxy.type}
            isLoading={loading}
            color={delayColor(delay)}
            onPress={onDelay}
            variant="light"
            className="h-full min-w-[50px] p-0 mx-2 text-sm hover:bg-content"
          >
            {delayText(delay)}
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

export default ProxyItem
