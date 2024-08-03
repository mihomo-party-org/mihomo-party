import { Button, Card, CardBody, Divider } from '@nextui-org/react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import PubSub from 'pubsub-js'
import React, { useEffect, useState } from 'react'

interface Props {
  onProxyDelay: (proxy: string) => Promise<IMihomoDelay>
  proxyDisplayMode: 'simple' | 'full'
  proxy: IMihomoProxy | IMihomoGroup
  group: string
  onSelect: (proxy: string) => void
  selected: boolean
}

const ProxyItem: React.FC<Props> = (props) => {
  const { proxyDisplayMode, group, proxy, selected, onSelect, onProxyDelay } = props
  const { appConfig } = useAppConfig()
  const { delayTestTimeout = 5000 } = appConfig || {}
  const [delay, setDelay] = useState(() => {
    if (proxy.history.length > 0) {
      return proxy.history[0].delay
    }
    return 0
  })
  const [loading, setLoading] = useState(false)

  function delayColor(delay: number): 'primary' | 'success' | 'warning' | 'danger' {
    if (delay < 0) return 'danger'
    if (delay === 0) return 'primary'
    if (delay < 500) return 'success'
    if (delay < delayTestTimeout) return 'warning'
    return 'danger'
  }

  function delayText(delay: number): string {
    if (delay < 0) return 'Error'
    if (delay === 0) return 'Delay'
    if (delay < delayTestTimeout) return delay.toString()
    return 'Timeout'
  }

  const onDelay = (): void => {
    setLoading(true)
    onProxyDelay(proxy.name).then(
      (delay) => {
        setDelay(delay.delay || delayTestTimeout + 1)
        setLoading(false)
      },
      () => {
        setDelay(-1)
        setLoading(false)
      }
    )
  }

  useEffect(() => {
    const token = PubSub.subscribe(`${group}-delay`, onDelay)

    return (): void => {
      PubSub.unsubscribe(token)
    }
  }, [])
  return (
    <>
      <Divider />
      <Card
        onPress={() => onSelect(proxy.name)}
        isPressable
        fullWidth
        className={`my-1 ${selected ? 'bg-primary/30' : ''}`}
        radius="sm"
      >
        <CardBody className="p-1">
          <div className="flex justify-between items-center">
            <div>
              <div className="inline">{proxy.name}</div>
              {proxyDisplayMode === 'full' && (
                <div className="inline ml-2 text-default-500">{proxy.type}</div>
              )}
            </div>
            <Button
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
    </>
  )
}

export default ProxyItem
