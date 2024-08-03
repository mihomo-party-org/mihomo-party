import { Accordion, AccordionItem, Avatar, Button } from '@nextui-org/react'
import BasePage from '@renderer/components/base/base-page'
import ProxyList from '@renderer/components/proxies/proxy-list'
import { useAppConfig } from '@renderer/hooks/use-config'
import { MdOutlineSpeed } from 'react-icons/md'
import { mihomoChangeProxy, mihomoProxies, mihomoProxyDelay } from '@renderer/utils/ipc'
import { CgDetailsLess, CgDetailsMore } from 'react-icons/cg'
import { useEffect, useMemo } from 'react'
import PubSub from 'pubsub-js'
import useSWR from 'swr'

const Proxies: React.FC = () => {
  const { data: proxies, mutate } = useSWR('mihomoProxies', mihomoProxies)
  const { appConfig, patchAppConfig } = useAppConfig()
  const { proxyDisplayMode = 'simple' } = appConfig || {}

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

  const onProxyDelay = async (proxy: string, url?: string): Promise<IMihomoDelay> => {
    return await mihomoProxyDelay(proxy, url)
  }

  useEffect(() => {}, [])
  return (
    <BasePage
      title="代理组"
      header={
        <Button
          size="sm"
          isIconOnly
          onPress={() => {
            patchAppConfig({ proxyDisplayMode: proxyDisplayMode === 'simple' ? 'full' : 'simple' })
          }}
        >
          {proxyDisplayMode === 'simple' ? (
            <CgDetailsMore size={20} />
          ) : (
            <CgDetailsLess size={20} />
          )}
        </Button>
      }
    >
      <Accordion variant="splitted" className="p-2">
        {groups.map((group) => {
          return (
            <AccordionItem
              key={group.name}
              title={
                <div className="flex justify-between">
                  <div>{group.name}</div>
                  <Button
                    variant="light"
                    size="sm"
                    isIconOnly
                    onPress={() => {
                      PubSub.publish(`${group.name}-delay`)
                    }}
                  >
                    <MdOutlineSpeed className="text-lg text-default-500" />
                  </Button>
                </div>
              }
              subtitle={
                proxyDisplayMode === 'full' && (
                  <div>
                    {group.type}
                    &nbsp;
                    {group.now}
                  </div>
                )
              }
              classNames={{ title: 'select-none', base: 'px-2', content: 'pt-2', trigger: 'py-2' }}
              startContent={
                group.icon.length > 0 ? (
                  <Avatar className="bg-transparent" size="sm" radius="sm" src={group.icon} />
                ) : null
              }
            >
              <ProxyList
                onProxyDelay={(proxy) => onProxyDelay(proxy, group.testUrl)}
                onChangeProxy={(proxy) => onChangeProxy(group.name, proxy)}
                proxyDisplayMode={proxyDisplayMode}
                proxies={groupProxies[group.name]}
                group={group.name}
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
