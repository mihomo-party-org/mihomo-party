import React from 'react'
import { Virtuoso } from 'react-virtuoso'
import ProxyItem from './proxy-item'

interface Props {
  onChangeProxy: (proxy: string) => void
  proxies: (IMihomoProxy | IMihomoGroup)[]
  now: string
}

const ProxyList: React.FC<Props> = (props) => {
  const { onChangeProxy, proxies, now } = props

  return (
    <Virtuoso
      style={{ height: `min(calc(100vh - 200px), ${proxies.length * 44}px)` }}
      totalCount={proxies.length}
      increaseViewportBy={100}
      itemContent={(index) => (
        <ProxyItem
          onSelect={onChangeProxy}
          proxy={proxies[index]}
          selected={proxies[index].name === now}
        />
      )}
    />
  )
}

export default ProxyList
