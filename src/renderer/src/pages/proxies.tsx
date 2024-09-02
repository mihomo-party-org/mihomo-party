import { Avatar, Button, Card, CardBody, Chip } from '@nextui-org/react'
import BasePage from '@renderer/components/base/base-page'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import {
  mihomoChangeProxy,
  mihomoCloseAllConnections,
  mihomoGroupDelay,
  mihomoProxyDelay
} from '@renderer/utils/ipc'
import { CgDetailsLess, CgDetailsMore } from 'react-icons/cg'
import { TbCircleLetterD } from 'react-icons/tb'
import { FaLocationCrosshairs } from 'react-icons/fa6'
import { RxLetterCaseCapitalize } from 'react-icons/rx'
import { useEffect, useMemo, useRef, useState } from 'react'
import { GroupedVirtuoso, GroupedVirtuosoHandle } from 'react-virtuoso'
import ProxyItem from '@renderer/components/proxies/proxy-item'
import { IoIosArrowBack } from 'react-icons/io'
import { MdOutlineSpeed } from 'react-icons/md'
import { useGroups } from '@renderer/hooks/use-groups'
import CollapseInput from '@renderer/components/base/collapse-input'

const Proxies: React.FC = () => {
  const { groups = [], mutate } = useGroups()
  const { appConfig, patchAppConfig } = useAppConfig()
  const {
    proxyDisplayMode = 'simple',
    proxyDisplayOrder = 'default',
    autoCloseConnection = true,
    proxyCols = 'auto'
  } = appConfig || {}
  const [cols, setCols] = useState(1)
  const [isOpen, setIsOpen] = useState(Array(groups.length).fill(false))
  const [searchValue, setSearchValue] = useState(Array(groups.length).fill(''))
  const virtuosoRef = useRef<GroupedVirtuosoHandle>(null)
  const { groupCounts, allProxies } = useMemo(() => {
    const groupCounts: number[] = []
    const allProxies: (IMihomoProxy | IMihomoGroup)[][] = []
    groups.forEach((group, index) => {
      if (isOpen[index]) {
        let groupProxies = group.all.filter((proxy) =>
          proxy.name.toLowerCase().includes(searchValue[index].toLowerCase())
        )
        const count = Math.floor(groupProxies.length / cols)
        groupCounts.push(groupProxies.length % cols === 0 ? count : count + 1)
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
        allProxies.push(groupProxies)
      } else {
        groupCounts.push(0)
        allProxies.push([])
      }
    })
    return { groupCounts, allProxies }
  }, [groups, isOpen, proxyDisplayOrder, cols, searchValue])

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

  const calcCols = (): number => {
    if (window.matchMedia('(min-width: 1536px)').matches) {
      return 5
    } else if (window.matchMedia('(min-width: 1280px)').matches) {
      return 4
    } else if (window.matchMedia('(min-width: 1024px)').matches) {
      return 3
    } else {
      return 2
    }
  }

  useEffect(() => {
    if (proxyCols !== 'auto') {
      setCols(parseInt(proxyCols))
      return
    }
    setCols(calcCols())
    window.onresize = (): void => {
      setCols(calcCols())
    }
    return (): void => {
      window.onresize = null
    }
  }, [])

  return (
    <BasePage
      title="代理组"
      header={
        <>
          <Button
            size="sm"
            isIconOnly
            variant="light"
            className="app-nodrag"
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
              <TbCircleLetterD className="text-lg" title="默认" />
            ) : proxyDisplayOrder === 'delay' ? (
              <MdOutlineSpeed className="text-lg" title="延迟" />
            ) : (
              <RxLetterCaseCapitalize className="text-lg" title="名称" />
            )}
          </Button>
          <Button
            size="sm"
            isIconOnly
            variant="light"
            className="app-nodrag"
            onPress={() => {
              patchAppConfig({
                proxyDisplayMode: proxyDisplayMode === 'simple' ? 'full' : 'simple'
              })
            }}
          >
            {proxyDisplayMode === 'full' ? (
              <CgDetailsMore className="text-lg" title="详细信息" />
            ) : (
              <CgDetailsLess className="text-lg" title="简洁信息" />
            )}
          </Button>
        </>
      }
    >
      <div className="h-[calc(100vh-50px)]">
        <GroupedVirtuoso
          ref={virtuosoRef}
          groupCounts={groupCounts}
          groupContent={(index) => {
            return groups[index] ? (
              <div
                className={`w-full pt-2 ${index === groupCounts.length - 1 && !isOpen[index] ? 'pb-2' : ''} px-2`}
              >
                <Card
                  isPressable
                  fullWidth
                  onClick={() => {
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
                            onLoad={() => {
                              const img = new Image()
                              img.crossOrigin = 'anonymous'
                              img.onload = (): void => {
                                const canvas = document.createElement('canvas')
                                const ctx = canvas.getContext('2d')
                                canvas.width = img.width
                                canvas.height = img.height
                                ctx?.drawImage(img, 0, 0)
                                const data = canvas.toDataURL('image/png')
                                localStorage.setItem(groups[index].icon, data)
                              }
                              img.src = groups[index].icon
                            }}
                            radius="sm"
                            src={localStorage.getItem(groups[index].icon) || groups[index].icon}
                          />
                        ) : null}
                        <div className="text-ellipsis overflow-hidden whitespace-nowrap">
                          <div
                            title={groups[index].name}
                            className="inline flag-emoji h-[32px] text-md leading-[32px]"
                          >
                            {groups[index].name}
                          </div>
                          {proxyDisplayMode === 'full' && (
                            <div
                              title={groups[index].type}
                              className="inline ml-2 text-sm text-default-500"
                            >
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
                        <CollapseInput
                          title="搜索节点"
                          value={searchValue[index]}
                          onValueChange={(v) => {
                            setSearchValue((prev) => {
                              const newSearchValue = [...prev]
                              newSearchValue[index] = v
                              return newSearchValue
                            })
                          }}
                        />
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
                            i += Math.floor(
                              allProxies[index].findIndex(
                                (proxy) => proxy.name === groups[index].now
                              ) / cols
                            )
                            virtuosoRef.current?.scrollToIndex({
                              index: Math.floor(i),
                              align: 'start'
                            })
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
            let innerIndex = index
            groupCounts.slice(0, groupIndex).forEach((count) => {
              innerIndex -= count
            })
            return allProxies[groupIndex] ? (
              <div
                style={
                  proxyCols !== 'auto'
                    ? { gridTemplateColumns: `repeat(${proxyCols}, minmax(0, 1fr))` }
                    : {}
                }
                className={`grid ${proxyCols === 'auto' ? 'sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5' : ''} gap-2 pt-2 mx-2`}
              >
                {Array.from({ length: cols }).map((_, i) => {
                  if (!allProxies[groupIndex][innerIndex * cols + i]) return null
                  return (
                    <ProxyItem
                      key={allProxies[groupIndex][innerIndex * cols + i].name}
                      mutateProxies={mutate}
                      onProxyDelay={onProxyDelay}
                      onSelect={onChangeProxy}
                      proxy={allProxies[groupIndex][innerIndex * cols + i]}
                      group={groups[groupIndex]}
                      proxyDisplayMode={proxyDisplayMode}
                      selected={
                        allProxies[groupIndex][innerIndex * cols + i]?.name ===
                        groups[groupIndex].now
                      }
                    />
                  )
                })}
              </div>
            ) : (
              <div>Never See This</div>
            )
          }}
        />
      </div>
    </BasePage>
  )
}

export default Proxies
