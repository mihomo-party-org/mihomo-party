import React from 'react'
import { Virtuoso } from 'react-virtuoso'
import ProxyItem from './proxy-item'

interface Props {
  onProxyDelay: (proxy: string) => Promise<IMihomoDelay>
  onChangeProxy: (proxy: string) => void
  proxyDisplayMode: 'simple' | 'full'
  proxies: (IMihomoProxy | IMihomoGroup)[]
  group: string
  now: string
}

const ProxyList: React.FC<Props> = (props) => {
  const { proxyDisplayMode, onProxyDelay, onChangeProxy, proxies, group, now } = props

  return (
    <Virtuoso
      style={{ height: `min(calc(100vh - 200px), ${proxies.length * 44}px)` }}
      totalCount={proxies.length}
      increaseViewportBy={100}
      itemContent={(index) => (
        <ProxyItem
          onProxyDelay={onProxyDelay}
          onSelect={onChangeProxy}
          proxy={proxies[index]}
          group={group}
          proxyDisplayMode={proxyDisplayMode}
          selected={proxies[index].name === now}
        />
      )}
    />
  )
}

export default ProxyList
