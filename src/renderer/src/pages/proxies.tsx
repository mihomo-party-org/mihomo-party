import { Avatar, Button, Card, CardBody, Chip } from '@heroui/react'
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
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { GroupedVirtuoso, GroupedVirtuosoHandle } from 'react-virtuoso'
import ProxyItem from '@renderer/components/proxies/proxy-item'
import { IoIosArrowBack } from 'react-icons/io'
import { MdDoubleArrow, MdOutlineSpeed } from 'react-icons/md'
import { useGroups } from '@renderer/hooks/use-groups'
import CollapseInput from '@renderer/components/base/collapse-input'
import { includesIgnoreCase } from '@renderer/utils/includes'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { useTranslation } from 'react-i18next'

const SCROLL_POSITION_KEY = 'proxy_scroll_position'
const GROUP_EXPAND_STATE_KEY = 'proxy_group_expand_state'
const SCROLL_DEBOUNCE_TIME = 200
const RENDER_DELAY = 100

// 自定义 hook 用于管理滚动位置和展开状态
const useProxyState = (groups: IMihomoMixedGroup[]) => {
  const virtuosoRef = useRef<GroupedVirtuosoHandle>(null)
  const [scrollPosition, setScrollPosition] = useState<number>(0)
  const scrollTimerRef = useRef<NodeJS.Timeout>()
  
  // 初始化展开状态
  const [isOpen, setIsOpen] = useState(() => {
    try {
      const savedState = localStorage.getItem(GROUP_EXPAND_STATE_KEY)
      return savedState ? JSON.parse(savedState) : Array(groups.length).fill(false)
    } catch (error) {
      console.error('Failed to load group expand state:', error)
      return Array(groups.length).fill(false)
    }
  })

  // 保存展开状态
  useEffect(() => {
    try {
      localStorage.setItem(GROUP_EXPAND_STATE_KEY, JSON.stringify(isOpen))
    } catch (error) {
      console.error('Failed to save group expand state:', error)
    }
  }, [isOpen])

  // 清理定时器
  useEffect(() => {
    return () => {
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current)
      }
    }
  }, [])

  // 恢复滚动位置
  useEffect(() => {
    if (groups.length > 0) {
      try {
        const savedPosition = localStorage.getItem(SCROLL_POSITION_KEY)
        if (savedPosition) {
          const position = parseInt(savedPosition)
          if (!isNaN(position) && position >= 0) {
            const timer = setTimeout(() => {
              virtuosoRef.current?.scrollTo({ top: position })
            }, RENDER_DELAY)
            return () => clearTimeout(timer)
          }
        }
      } catch (error) {
        console.error('Failed to restore scroll position:', error)
      }
    }
  }, [groups])

  const saveScrollPosition = useCallback((position: number) => {
    try {
      localStorage.setItem(SCROLL_POSITION_KEY, position.toString())
    } catch (error) {
      console.error('Failed to save scroll position:', error)
    }
  }, [])

  return {
    virtuosoRef,
    isOpen,
    setIsOpen,
    scrollPosition,
    onScroll: useCallback((e: React.UIEvent<HTMLElement>) => {
      const position = (e.target as HTMLElement).scrollTop
      setScrollPosition(position)
      
      // 清理之前的定时器
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current)
      }
      
      // 使用防抖来减少存储频率
      scrollTimerRef.current = setTimeout(() => {
        saveScrollPosition(position)
      }, SCROLL_DEBOUNCE_TIME)
    }, [saveScrollPosition])
  }
}

const Proxies: React.FC = () => {
  const { t } = useTranslation()
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
  const { virtuosoRef, isOpen, setIsOpen, onScroll, scrollPosition } = useProxyState(groups)
  const [delaying, setDelaying] = useState(Array(groups.length).fill(false))
  const [searchValue, setSearchValue] = useState(Array(groups.length).fill(''))
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

  const onChangeProxy = useCallback(async (group: string, proxy: string): Promise<void> => {
    await mihomoChangeProxy(group, proxy)
    if (autoCloseConnection) {
      await mihomoCloseAllConnections()
    }
    mutate()
    // 等待 DOM 更新完成后再恢复滚动位置
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        virtuosoRef.current?.scrollTo({ top: scrollPosition })
      })
    })
  }, [autoCloseConnection, mutate, virtuosoRef, scrollPosition])

  const onProxyDelay = useCallback(async (proxy: string, url?: string): Promise<IMihomoDelay> => {
    return await mihomoProxyDelay(proxy, url)
  }, [])

  const onGroupDelay = useCallback(async (index: number): Promise<void> => {
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

    try {
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
    } finally {
      setDelaying((prev) => {
        const newDelaying = [...prev]
        newDelaying[index] = false
        return newDelaying
      })
    }
  }, [allProxies, groups, delayTestConcurrency, mutate])

  const calcCols = useCallback((): number => {
    if (proxyCols !== 'auto') {
      return parseInt(proxyCols)
    }
    if (window.matchMedia('(min-width: 1536px)').matches) return 5
    if (window.matchMedia('(min-width: 1280px)').matches) return 4
    if (window.matchMedia('(min-width: 1024px)').matches) return 3
    return 2
  }, [proxyCols])

  useEffect(() => {
    const handleResize = (): void => {
      setCols(calcCols())
    }

    handleResize() // 初始化
    window.addEventListener('resize', handleResize)
    
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [calcCols])

  return (
    <BasePage
      title={t('proxies.title')}
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
              <TbCircleLetterD className="text-lg" title={t('proxies.order.default')} />
            ) : proxyDisplayOrder === 'delay' ? (
              <MdOutlineSpeed className="text-lg" title={t('proxies.order.delay')} />
            ) : (
              <RxLetterCaseCapitalize className="text-lg" title={t('proxies.order.name')} />
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
              <CgDetailsMore className="text-lg" title={t('proxies.mode.full')} />
            ) : (
              <CgDetailsLess className="text-lg" title={t('proxies.mode.simple')} />
            )}
          </Button>
        </>
      }
    >
      {mode === 'direct' ? (
        <div className="h-full w-full flex justify-center items-center">
          <div className="flex flex-col items-center">
            <MdDoubleArrow className="text-foreground-500 text-[100px]" />
            <h2 className="text-foreground-500 text-[20px]">{t('proxies.mode.direct')}</h2>
          </div>
        </div>
      ) : (
        <div className="h-[calc(100vh-50px)]">
          <GroupedVirtuoso
            ref={virtuosoRef}
            groupCounts={groupCounts}
            onScroll={onScroll}
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
                    as="div"
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
                              title={t('proxies.search.placeholder')}
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
                              title={t('proxies.locate')}
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
                              title={t('proxies.delay.test')}
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