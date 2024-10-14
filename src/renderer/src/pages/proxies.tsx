import { Avatar, Button, Card, CardBody, Chip } from '@nextui-org/react'
import BasePage from '@renderer/components/base/base-page'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import {
  getImageDataURL,
  mihomoChangeProxy,
  mihomoCloseAllConnections,
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
import { MdDoubleArrow, MdOutlineSpeed } from 'react-icons/md'
import { useGroups } from '@renderer/hooks/use-groups'
import CollapseInput from '@renderer/components/base/collapse-input'
import { includesIgnoreCase } from '@renderer/utils/includes'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'

const Proxies: React.FC = () => {
  const { controledMihomoConfig } = useControledMihomoConfig()
  const { mode = 'rule' } = controledMihomoConfig || {}
  const { groups = [], mutate } = useGroups()
  const { appConfig, patchAppConfig } = useAppConfig()
  const {
    proxyDisplayMode = 'simple',
    proxyDisplayOrder = 'default',
    autoCloseConnection = true,
    proxyCols = 'auto',
    delayTestConcurrency = 50
  } = appConfig || {}
  const [cols, setCols] = useState(1)
  const [isOpen, setIsOpen] = useState(Array(groups.length).fill(false))
  const [delaying, setDelaying] = useState(Array(groups.length).fill(false))
  const [searchValue, setSearchValue] = useState(Array(groups.length).fill(''))
  const virtuosoRef = useRef<GroupedVirtuosoHandle>(null)
  const { groupCounts, allProxies } = useMemo(() => {
    const groupCounts: number[] = []
    const allProxies: (IMihomoProxy | IMihomoGroup)[][] = []
    if (groups.length !== searchValue.length) setSearchValue(Array(groups.length).fill(''))
    groups.forEach((group, index) => {
      if (isOpen[index]) {
        let groupProxies = group.all.filter(
          (proxy) => proxy && includesIgnoreCase(proxy.name, searchValue[index])
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

  const onGroupDelay = async (index: number): Promise<void> => {
    if (allProxies[index].length === 0) {
      setIsOpen((prev) => {
        const newOpen = [...prev]
        newOpen[index] = true
        return newOpen
      })
    }
    setDelaying((prev) => {
      const newDelaying = [...prev]
      newDelaying[index] = true
      return newDelaying
    })
    // 限制并发数量
    const result: Promise<void>[] = []
    const runningList: Promise<void>[] = []
    for (const proxy of allProxies[index]) {
      const promise = Promise.resolve().then(async () => {
        try {
          await mihomoProxyDelay(proxy.name, groups[index].testUrl)
        } catch {
          // ignore
        } finally {
          mutate()
        }
      })
      result.push(promise)
      const running = promise.then(() => {
        runningList.splice(runningList.indexOf(running), 1)
      })
      runningList.push(running)
      if (runningList.length >= (delayTestConcurrency || 50)) {
        await Promise.race(runningList)
      }
    }
    await Promise.all(result)
    setDelaying((prev) => {
      const newDelaying = [...prev]
      newDelaying[index] = false
      return newDelaying
    })
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
      {mode === 'direct' ? (
        <div className="h-full w-full flex justify-center items-center">
          <div className="flex flex-col items-center">
            <MdDoubleArrow className="text-foreground-500 text-[100px]" />
            <h2 className="text-foreground-500 text-[20px]">直连模式</h2>
          </div>
        </div>
      ) : (
        <div className="h-[calc(100vh-50px)]">
          <GroupedVirtuoso
            ref={virtuosoRef}
            groupCounts={groupCounts}
            groupContent={(index) => {
              if (
                groups[index] &&
                groups[index].icon &&
                groups[index].icon.startsWith('http') &&
                !localStorage.getItem(groups[index].icon)
              ) {
                getImageDataURL(groups[index].icon).then((dataURL) => {
                  localStorage.setItem(groups[index].icon, dataURL)
                  mutate()
                })
              }
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
                              radius="sm"
                              src={
                                groups[index].icon.startsWith('<svg')
                                  ? `data:image/svg+xml;utf8,${groups[index].icon}`
                                  : localStorage.getItem(groups[index].icon) || groups[index].icon
                              }
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
                                className="inline ml-2 text-sm text-foreground-500"
                              >
                                {groups[index].type}
                              </div>
                            )}
                            {proxyDisplayMode === 'full' && (
                              <div className="inline flag-emoji ml-2 text-sm text-foreground-500">
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
                              if (!isOpen[index]) {
                                setIsOpen((prev) => {
                                  const newOpen = [...prev]
                                  newOpen[index] = true
                                  return newOpen
                                })
                              }
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
                            <FaLocationCrosshairs className="text-lg text-foreground-500" />
                          </Button>
                          <Button
                            title="延迟测试"
                            variant="light"
                            isLoading={delaying[index]}
                            size="sm"
                            isIconOnly
                            onPress={() => {
                              onGroupDelay(index)
                            }}
                          >
                            <MdOutlineSpeed className="text-lg text-foreground-500" />
                          </Button>
                          <IoIosArrowBack
                            className={`transition duration-200 ml-2 h-[32px] text-lg text-foreground-500 ${isOpen[index] ? '-rotate-90' : ''}`}
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
                  className={`grid ${proxyCols === 'auto' ? 'sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5' : ''} ${groupIndex === groupCounts.length - 1 && innerIndex === groupCounts[groupIndex] - 1 ? 'pb-2' : ''} gap-2 pt-2 mx-2`}
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
      )}
    </BasePage>
  )
}

export default Proxies
