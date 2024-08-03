import { Accordion, AccordionItem, Avatar } from '@nextui-org/react'
import BasePage from '@renderer/components/base/base-page'
import ProxyList from '@renderer/components/proxies/proxy-list'
import { mihomoChangeProxy, mihomoProxies } from '@renderer/utils/ipc'
import { useEffect, useMemo } from 'react'
import useSWR from 'swr'

const Proxies: React.FC = () => {
  const { data: proxies, mutate } = useSWR('mihomoProxies', mihomoProxies)

  const groups = useMemo(() => {
    const groups: IMihomoGroup[] = []
    if (proxies) {
      const globalGroup = proxies.proxies['GLOBAL'] as IMihomoGroup
      for (const global of globalGroup.all) {
        if (isGroup(proxies.proxies[global])) {
          groups.push(proxies.proxies[global] as IMihomoGroup)
        }
      }
      Object.keys(proxies.proxies).forEach((key) => {
        if (isGroup(proxies.proxies[key])) {
          if (!groups.find((group) => group.name === key)) {
            groups.push(proxies.proxies[key] as IMihomoGroup)
          }
        }
      })
    }
    return groups
  }, [proxies])

  const groupProxies = useMemo(() => {
    const groupProxies: Record<string, (IMihomoProxy | IMihomoGroup)[]> = {}
    if (proxies) {
      for (const group of groups) {
        groupProxies[group.name] = group.all.map((name) => proxies.proxies[name])
      }
    }
    return groupProxies
  }, [proxies])

  const onChangeProxy = (group: string, proxy: string): void => {
    mihomoChangeProxy(group, proxy).then(() => {
      mutate()
    })
  }

  useEffect(() => {}, [])
  return (
    <BasePage title="代理组">
      <Accordion variant="splitted" className="p-2">
        {groups.map((group) => {
          return (
            <AccordionItem
              key={group.name}
              title={group.name}
              classNames={{ content: 'p-0' }}
              startContent={
                group.icon.length > 0 ? (
                  <Avatar className="bg-transparent" size="sm" radius="sm" src={group.icon} />
                ) : null
              }
            >
              <ProxyList
                onChangeProxy={(proxy) => onChangeProxy(group.name, proxy)}
                proxies={groupProxies[group.name]}
                now={group.now}
              />
            </AccordionItem>
          )
        })}
      </Accordion>
    </BasePage>
  )
}

function isGroup(proxy: IMihomoProxy | IMihomoGroup): proxy is IMihomoGroup {
  return 'all' in proxy
}

export default Proxies
