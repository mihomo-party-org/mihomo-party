import { Avatar, Button, Card, CardBody, Chip } from '@nextui-org/react'
import BasePage from '@renderer/components/base/base-page'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import {
  getRuntimeConfig,
  mihomoChangeProxy,
  mihomoCloseAllConnections,
  mihomoGroupDelay,
  mihomoProxies,
  mihomoProxyDelay
} from '@renderer/utils/ipc'
import { CgDetailsLess, CgDetailsMore } from 'react-icons/cg'
import { FaBoltLightning } from 'react-icons/fa6'
import { TbCircleLetterD } from 'react-icons/tb'
import { FaLocationCrosshairs } from 'react-icons/fa6'
import { RxLetterCaseCapitalize } from 'react-icons/rx'
import { useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import { GroupedVirtuoso, GroupedVirtuosoHandle } from 'react-virtuoso'
import ProxyItem from '@renderer/components/proxies/proxy-item'
import { IoIosArrowBack } from 'react-icons/io'
import { MdOutlineSpeed } from 'react-icons/md'

const Proxies: React.FC = () => {
  const { data: proxies, mutate } = useSWR('mihomoProxies', mihomoProxies)
  const { data: runtime } = useSWR('getRuntimeConfig', getRuntimeConfig)
  const { appConfig, patchAppConfig } = useAppConfig()
  const {
    proxyDisplayMode = 'simple',
    proxyDisplayOrder = 'default',
    autoCloseConnection = true
  } = appConfig || {}

  const groups = useMemo(() => {
    if (!proxies) return []
    if (!proxies.proxies) return []
    const groups: IMihomoGroup[] = []
    runtime?.['proxy-groups']?.forEach((group: { name: string; url?: string }) => {
      group = Object.assign(group, group['<<'])
      const { name, url } = group
      if (
        proxies.proxies[name] &&
        isGroup(proxies.proxies[name]) &&
        !proxies.proxies[name].hidden
      ) {
        const newGroup = proxies.proxies[name]
        newGroup.testUrl = url
        groups.push(newGroup as IMihomoGroup)
      }
    })
    if (!groups.find((group) => group.name === 'GLOBAL')) {
      groups.push(proxies.proxies['GLOBAL'] as IMihomoGroup)
    }
    return groups
  }, [proxies, runtime])

  const [isOpen, setIsOpen] = useState(Array(groups.length).fill(false))
  const virtuosoRef = useRef<GroupedVirtuosoHandle>(null)
  const { groupCounts, allProxies } = useMemo(() => {
    const groupCounts = groups.map((group, index) => {
      return isOpen[index] ? group.all.length : 0
    })
    const allProxies: (IMihomoProxy | IMihomoGroup)[] = []
    groups.forEach((group, index) => {
      if (isOpen[index] && proxies) {
        let groupProxies = group.all.map((name) => proxies.proxies[name])
        if (proxyDisplayOrder === 'delay') {
          groupProxies = groupProxies.sort((a, b) => {
            if (a.history.length === 0) return -1
            if (b.history.length === 0) return 1
            if (a.history[a.history.length - 1].delay === 0) return 1
            if (b.history[b.history.length - 1].delay === 0) return -1
            return a.history[a.history.length - 1].delay - b.history[b.history.length - 1].delay
          })
        }
        if (proxyDisplayOrder === 'name') {
          groupProxies = groupProxies.sort((a, b) => a.name.localeCompare(b.name))
        }
        allProxies.push(...groupProxies)
      }
    })

    return { groupCounts, allProxies }
  }, [groups, isOpen, proxyDisplayOrder])

  const onChangeProxy = async (group: string, proxy: string): Promise<void> => {
    await mihomoChangeProxy(group, proxy)
    if (autoCloseConnection) {
      await mihomoCloseAllConnections()
    }
    mutate()
  }

  const onProxyDelay = async (proxy: string, url?: string): Promise<IMihomoDelay> => {
    return await mihomoProxyDelay(proxy, url)
  }

  const onGroupDelay = async (group: string, url?: string): Promise<void> => {
    PubSub.publish(`${group}-delay`)
    await mihomoGroupDelay(group, url)
  }

  return (
    <BasePage
      title="代理组"
      header={
        <div>
          <Button
            size="sm"
            isIconOnly
            onPress={() => {
              patchAppConfig({
                proxyDisplayOrder:
                  proxyDisplayOrder === 'default'
                    ? 'delay'
                    : proxyDisplayOrder === 'delay'
                      ? 'name'
                      : 'default'
              })
            }}
          >
            {proxyDisplayOrder === 'default' ? (
              <TbCircleLetterD size={20} title="默认" />
            ) : proxyDisplayOrder === 'delay' ? (
              <FaBoltLightning size={20} title="延迟" />
            ) : (
              <RxLetterCaseCapitalize size={20} title="名称" />
            )}
          </Button>
          <Button
            size="sm"
            isIconOnly
            className="ml-2"
            onPress={() => {
              patchAppConfig({
                proxyDisplayMode: proxyDisplayMode === 'simple' ? 'full' : 'simple'
              })
            }}
          >
            {proxyDisplayMode === 'simple' ? (
              <CgDetailsMore size={20} title="详细信息" />
            ) : (
              <CgDetailsLess size={20} title="简洁信息" />
            )}
          </Button>
        </div>
      }
    >
      <GroupedVirtuoso
        ref={virtuosoRef}
        style={{ height: 'calc(100vh - 50px)' }}
        groupCounts={groupCounts}
        groupContent={(index) => {
          return groups[index] ? (
            <div
              className={`w-full pt-2 ${index === groupCounts.length - 1 && !isOpen[index] ? 'pb-2' : ''} px-2`}
            >
              <Card
                isPressable
                fullWidth
                onPress={() => {
                  setIsOpen((prev) => {
                    const newOpen = [...prev]
                    newOpen[index] = !prev[index]
                    return newOpen
                  })
                }}
              >
                <CardBody className="w-full">
                  <div className="flex justify-between">
                    <div className="flex text-ellipsis overflow-hidden whitespace-nowrap">
                      {groups[index].icon ? (
                        <Avatar
                          className="bg-transparent mr-2"
                          size="sm"
                          radius="sm"
                          src={groups[index].icon}
                        />
                      ) : null}
                      <div className="text-ellipsis overflow-hidden whitespace-nowrap">
                        <div className="inline flag-emoji h-[32px] text-md leading-[32px]">
                          {groups[index].name}
                        </div>

                        {proxyDisplayMode === 'full' && (
                          <div className="inline ml-2 text-sm text-default-500">
                            {groups[index].type}
                          </div>
                        )}
                        {proxyDisplayMode === 'full' && (
                          <div className="inline flag-emoji ml-2 text-sm text-default-500">
                            {groups[index].now}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex">
                      {proxyDisplayMode === 'full' && (
                        <Chip size="sm" className="my-1 mr-2">
                          {groups[index].all.length}
                        </Chip>
                      )}
                      <Button
                        title="定位到当前节点"
                        variant="light"
                        size="sm"
                        isIconOnly
                        onPress={() => {
                          if (!isOpen[index]) return
                          let i = 0
                          for (let j = 0; j < index; j++) {
                            i += groupCounts[j]
                          }
                          for (let j = 0; j < groupCounts[index]; j++) {
                            if (allProxies[i + j].name === groups[index].now) {
                              i += j
                              break
                            }
                          }
                          virtuosoRef.current?.scrollToIndex({ index: i, align: 'start' })
                        }}
                      >
                        <FaLocationCrosshairs className="text-lg text-default-500" />
                      </Button>
                      <Button
                        title="延迟测试"
                        variant="light"
                        size="sm"
                        isIconOnly
                        onPress={() => {
                          onGroupDelay(groups[index].name, groups[index].testUrl)
                        }}
                      >
                        <MdOutlineSpeed className="text-lg text-default-500" />
                      </Button>
                      <IoIosArrowBack
                        className={`transition duration-200 ml-2 h-[32px] text-lg text-default-500 ${isOpen[index] ? '-rotate-90' : ''}`}
                      />
                    </div>
                  </div>
                </CardBody>
              </Card>
            </div>
          ) : (
            <div>Never See This</div>
          )
        }}
        itemContent={(index, groupIndex) => {
          return allProxies[index] ? (
            <div className="pt-2 mx-2">
              <ProxyItem
                mutateProxies={mutate}
                onProxyDelay={onProxyDelay}
                onSelect={onChangeProxy}
                proxy={allProxies[index]}
                group={groups[groupIndex]}
                proxyDisplayMode={proxyDisplayMode}
                selected={allProxies[index]?.name === groups[groupIndex].now}
              />
            </div>
          ) : (
            <div>Never See This</div>
          )
        }}
      />
    </BasePage>
  )
}

function isGroup(proxy: IMihomoProxy | IMihomoGroup): proxy is IMihomoGroup {
  return 'all' in proxy
}

export default Proxies
