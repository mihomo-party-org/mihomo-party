import { Button, Card, CardBody } from '@nextui-org/react'
import { mihomoUnfixedProxy } from '@renderer/utils/ipc'
import React, { useMemo, useState } from 'react'
import { FaMapPin } from 'react-icons/fa6'

interface Props {
  mutateProxies: () => void
  onProxyDelay: (proxy: string, url?: string) => Promise<IMihomoDelay>
  proxyDisplayMode: 'simple' | 'full'
  proxy: IMihomoProxy | IMihomoGroup
  group: IMihomoMixedGroup
  onSelect: (group: string, proxy: string) => void
  selected: boolean
  proxySelect: string | undefined
}

const ProxyItem: React.FC<Props> = (props) => {
  const {
    mutateProxies,
    proxyDisplayMode,
    group,
    proxy,
    selected,
    onSelect,
    onProxyDelay,
    proxySelect: nowSelect
  } = props

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
            <div>
              <div className="flag-emoji inline" title={proxy.name}>
                {proxy.name}
              </div>
            </div>
            {proxyDisplayMode === 'full' && (
              <div className="flex gap-1 text-xs text-foreground-500">
                {nowSelect && (
                  <span className="flag-emoji" title={nowSelect}>
                    {nowSelect}
                  </span>
                )}
                <span title={proxy.type}>{proxy.type}</span>
                {proxy.udp && <span title="UDP">UDP</span>}
                {proxy.xudp && <span title="XUDP">XUDP</span>}
                {proxy.tfo && <span title="TFO">TFO</span>}
              </div>
            )}
          </div>
          <div className="flex justify-end">
            {fixed && (
              <Button
                isIconOnly
                title="取消固定"
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
              className="h-full p-0 text-sm"
            >
              {delayText(delay)}
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  )
}

export default ProxyItem
