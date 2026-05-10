import { ExpandMoreRounded } from '@mui/icons-material'
import {
  Alert,
  alpha,
  Box,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Snackbar,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useLockFn } from 'ahooks'
import {
  type Key,
  type MouseEvent,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import { delayGroup, healthcheckProxyProvider } from 'tauri-plugin-mihomo-api'

import { BaseEmpty } from '@/components/base'
import { useProxySelection } from '@/hooks/use-proxy-selection'
import { useVerge } from '@/hooks/use-verge'
import { useProxiesData } from '@/providers/app-data-context'
import { calcuProxies, updateProxyChainConfigInRuntime } from '@/services/cmds'
import delayManager from '@/services/delay'
import { debugLog } from '@/utils/debug'

import { ScrollTopButton } from '../layout/scroll-top-button'

import { ProxyChain } from './proxy-chain'
import { ProxyRender } from './proxy-render'
import type { HeadState } from './use-head-state'
import { type IRenderItem, useRenderList } from './use-render-list'

function useStableCallback<T extends (...args: any[]) => any>(fn: T): T {
  const ref = useRef(fn)
  ref.current = fn
  return useCallback((...args: Parameters<T>) => ref.current(...args), []) as T
}

interface Props {
  mode: string
  isChainMode?: boolean
  chainConfigData?: string | null
}

interface ProxyChainItem {
  id: string
  name: string
  type?: string
  delay?: number
}

export const ProxyGroups = (props: Props) => {
  const { t } = useTranslation()
  const { mode, isChainMode = false, chainConfigData } = props

  // Drive 3s polling on the shared TQ cache; data is read via granular context below
  useQuery({
    queryKey: ['getProxies'],
    queryFn: calcuProxies,
    refetchInterval: 3000,
    refetchIntervalInBackground: false,
    staleTime: 1500,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  const [proxyChain, setProxyChain] = useState<ProxyChainItem[]>(() => {
    try {
      const saved = localStorage.getItem('proxy-chain-items')
      if (saved) {
        return JSON.parse(saved)
      }
    } catch {
      // ignore
    }
    return []
  })
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)

  useEffect(() => {
    if (proxyChain.length > 0) {
      localStorage.setItem('proxy-chain-items', JSON.stringify(proxyChain))
    } else {
      localStorage.removeItem('proxy-chain-items')
    }
  }, [proxyChain])
  const [ruleMenuAnchor, setRuleMenuAnchor] = useState<null | HTMLElement>(null)
  const [duplicateWarning, setDuplicateWarning] = useState<{
    open: boolean
    message: string
  }>({ open: false, message: '' })

  const { verge } = useVerge()
  const { proxies: proxiesData } = useProxiesData()
  const groups = proxiesData?.groups
  const availableGroups = useMemo(() => {
    if (!groups) return []
    // 在链式代理模式下，仅显示支持选择节点的 Selector 代理组
    return isChainMode
      ? groups.filter((g: any) => g.type === 'Selector')
      : groups
  }, [groups, isChainMode])

  const defaultRuleGroup = useMemo(() => {
    if (isChainMode && mode === 'rule' && availableGroups.length > 0) {
      return availableGroups[0].name
    }
    return null
  }, [availableGroups, isChainMode, mode])

  const activeSelectedGroup = useMemo(
    () => selectedGroup ?? defaultRuleGroup,
    [selectedGroup, defaultRuleGroup],
  )

  const { renderList, onProxies, onHeadState } = useRenderList(
    mode,
    isChainMode,
    activeSelectedGroup,
  )

  const getGroupHeadState = useCallback(
    (groupName: string) => {
      const headItem = renderList.find(
        (item) => item.type === 1 && item.group?.name === groupName,
      )
      return headItem?.headState
    },
    [renderList],
  )

  // 统代理选择
  const { handleProxyGroupChange } = useProxySelection({
    onSuccess: () => {
      onProxies()
    },
    onError: (error) => {
      console.error('代理切换失败', error)
      onProxies()
    },
  })

  const timeout = verge?.default_latency_timeout || 10000

  const parentRef = useRef<HTMLDivElement>(null)
  const scrollPositionRef = useRef<Record<string, number>>({})
  const showScrollTopRef = useRef(false)
  const [showScrollTop, setShowScrollTop] = useState(false)

  // ---- 钉住的 group 列表 (持久化到 localStorage) ----
  const PINNED_KEY = 'proxy-pinned-groups'
  const [pinnedNames, setPinnedNames] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(PINNED_KEY)
      const parsed = raw ? JSON.parse(raw) : []
      return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []
    } catch {
      return []
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(PINNED_KEY, JSON.stringify(pinnedNames))
    } catch {}
  }, [pinnedNames])
  const togglePin = useCallback((groupName: string) => {
    setPinnedNames((prev) =>
      prev.includes(groupName)
        ? prev.filter((n) => n !== groupName)
        : [...prev, groupName],
    )
  }, [])
  const pinnedSet = useMemo(() => new Set(pinnedNames), [pinnedNames])

  // 平滑跳转到指定 group (用 data-group 属性定位)
  // 如果 group 没展开会先自动展开, 然后等 DOM 更新后再滚动到位
  const jumpToGroup = useStableCallback((groupName: string) => {
    const head = getGroupHeadState(groupName)
    const wasClosed = !head?.open

    // 如果当前是收起状态, 先触发展开
    if (wasClosed) {
      onHeadState(groupName, { open: true })
    }

    // scrollTo 实际操作:
    // - 如果原本就展开, 直接同步滚
    // - 如果刚展开, 用 requestAnimationFrame 等下一帧让 DOM reflow,
    //   再读 offsetTop (这时是展开后的最新位置) 再滚
    const doScroll = () => {
      const root = parentRef.current
      if (!root) return
      const safe = groupName.replace(/"/g, '\\"')
      const target = root.querySelector<HTMLElement>(`[data-group="${safe}"]`)
      if (!target) return
      // scrollTo (而非 scrollIntoView) —— 后者会让所有祖先 scroll 一起滚
      const targetTop = target.offsetTop - root.offsetTop
      root.scrollTo({ top: targetTop, behavior: 'smooth' })
    }

    if (wasClosed) {
      // 双 rAF: 第一帧 commit state, 第二帧 layout 完成
      requestAnimationFrame(() => requestAnimationFrame(doScroll))
    } else {
      doScroll()
    }
  })

  const virtualizer = useVirtualizer({
    count: renderList.length,
    getScrollElement: () => parentRef.current,
    // estimateSize 必须跟 ProxyItemMini.height (60) 一致
    // 否则 measureElement 测出真实高度后会修正 transform 让列表"跳一下"
    estimateSize: () => 60,
    overscan: 30, // 加大 overscan，新 item 进入视口前已测量好，避免可见区域跳
    getItemKey: (index) => renderList[index]?.key ?? index,
  })
  const virtualItems = virtualizer.getVirtualItems()
  const stickyGroupByIndex = useMemo(
    () => getStickyGroupByIndex(renderList),
    [renderList],
  )
  const stickyGroupItem = getStickyGroupItem(
    stickyGroupByIndex,
    virtualItems,
    virtualizer.scrollOffset ?? 0,
  )

  // 从 localStorage 恢复滚动位置
  // 关键: deps 只能依赖 mode (规则/全局/直连切换时恢复)
  // 不能依赖 renderList.length —— 否则点 chevron 展开/收起组改变节点数时,
  // 会重跑 effect 把 scrollTop 强制跳回旧位置,造成"乱动"
  useEffect(() => {
    let restoreTimer: ReturnType<typeof setTimeout> | null = null

    try {
      const savedPositions = localStorage.getItem('proxy-scroll-positions')
      if (savedPositions) {
        const positions = JSON.parse(savedPositions)
        scrollPositionRef.current = positions
        const savedPosition = positions[mode]

        if (savedPosition !== undefined) {
          restoreTimer = setTimeout(() => {
            if (parentRef.current) {
              parentRef.current.scrollTop = savedPosition
              const nextShowScrollTop = savedPosition > 100
              showScrollTopRef.current = nextShowScrollTop
              setShowScrollTop(nextShowScrollTop)
            }
          }, 100)
        }
      }
    } catch (e) {
      console.error('Error restoring scroll position:', e)
    }

    return () => {
      if (restoreTimer) {
        clearTimeout(restoreTimer)
      }
    }
  }, [mode])

  // 改为使用节流函数保存滚动位置
  const saveScrollPosition = useCallback(
    (scrollTop: number) => {
      try {
        scrollPositionRef.current[mode] = scrollTop
        localStorage.setItem(
          'proxy-scroll-positions',
          JSON.stringify(scrollPositionRef.current),
        )
      } catch (e) {
        console.error('Error saving scroll position:', e)
      }
    },
    [mode],
  )

  const saveScrollPositionThrottled = useMemo(
    () => throttle(saveScrollPosition, 500),
    [saveScrollPosition],
  )

  const handleScroll = useCallback(
    (event: Event) => {
      const target = event.target as HTMLElement | null
      const nextScrollTop = target?.scrollTop ?? 0
      const nextShowScrollTop = nextScrollTop > 100

      if (showScrollTopRef.current !== nextShowScrollTop) {
        showScrollTopRef.current = nextShowScrollTop
        setShowScrollTop(nextShowScrollTop)
      }

      saveScrollPositionThrottled(nextScrollTop)
    },
    [saveScrollPositionThrottled],
  )

  // 添加和清理滚动事件监听器
  useEffect(() => {
    const node = parentRef.current
    if (!node) return

    const listener = handleScroll as EventListener
    const options: AddEventListenerOptions = { passive: true }

    node.addEventListener('scroll', listener, options)

    return () => {
      node.removeEventListener('scroll', listener, options)
    }
  }, [handleScroll])

  // 滚动到顶部
  const scrollToTop = useCallback(() => {
    parentRef.current?.scrollTo?.({
      top: 0,
      behavior: 'smooth',
    })
    saveScrollPosition(0)
  }, [saveScrollPosition])

  // 关闭重复节点警告
  const handleCloseDuplicateWarning = useCallback(() => {
    setDuplicateWarning({ open: false, message: '' })
  }, [])

  const currentGroup = useMemo(() => {
    if (!activeSelectedGroup) return null
    return (
      availableGroups.find(
        (group: any) => group.name === activeSelectedGroup,
      ) ?? null
    )
  }, [activeSelectedGroup, availableGroups])

  // 处理代理组选择菜单
  const handleGroupMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setRuleMenuAnchor(event.currentTarget)
  }

  const handleGroupMenuClose = () => {
    setRuleMenuAnchor(null)
  }

  const handleGroupSelect = (groupName: string) => {
    setSelectedGroup(groupName)
    handleGroupMenuClose()

    if (isChainMode && mode === 'rule') {
      updateProxyChainConfigInRuntime(null)
      localStorage.removeItem('proxy-chain-group')
      localStorage.removeItem('proxy-chain-exit-node')
      localStorage.removeItem('proxy-chain-items')
      setProxyChain([])
    }
  }

  const handleChangeProxy = useCallback(
    (group: IProxyGroupItem, proxy: IProxyItem) => {
      if (isChainMode) {
        // 使用函数式更新来避免状态延迟问题
        setProxyChain((prev) => {
          // 检查是否已经存在相同名称的代理，防止重复添加
          if (prev.some((item) => item.name === proxy.name)) {
            const warningMessage = t('proxies.page.chain.duplicateNode')
            setDuplicateWarning({
              open: true,
              message: warningMessage,
            })
            return prev // 返回原来的状态，不做任何更改
          }

          // 安全获取延迟数据，如果没有延迟数据则设为 undefined
          const delay =
            proxy.history && proxy.history.length > 0
              ? proxy.history[proxy.history.length - 1].delay
              : undefined

          const chainItem: ProxyChainItem = {
            id: `${proxy.name}_${Date.now()}`,
            name: proxy.name,
            type: proxy.type,
            delay: delay,
          }

          return [...prev, chainItem]
        })
        return
      }

      if (!['Selector', 'URLTest', 'Fallback'].includes(group.type)) return

      handleProxyGroupChange(group, proxy)
    },
    [handleProxyGroupChange, isChainMode, t],
  )

  // 测全部延迟
  const handleCheckAll = useStableCallback(
    useLockFn(async (groupName: string) => {
      debugLog(`[ProxyGroups] 开始测试所有延迟，组: ${groupName}`)

      const proxies = renderList
        .filter(
          (e) => e.group?.name === groupName && (e.type === 2 || e.type === 4),
        )
        .flatMap((e) => e.proxyCol || e.proxy!)
        .filter(Boolean)

      debugLog(`[ProxyGroups] 找到代理数量: ${proxies.length}`)

      const providers = new Set(
        proxies.map((p) => p!.provider!).filter(Boolean),
      )

      if (providers.size) {
        debugLog(`[ProxyGroups] 发现提供者，数量: ${providers.size}`)
        Promise.allSettled(
          [...providers].map((p) => healthcheckProxyProvider(p)),
        ).then(() => {
          debugLog(`[ProxyGroups] 提供者健康检查完成`)
          onProxies()
        })
      }

      const names = proxies.filter((p) => !p!.provider).map((p) => p!.name)
      debugLog(`[ProxyGroups] 过滤后需要测试的代理数量: ${names.length}`)

      const url = delayManager.getUrl(groupName)
      debugLog(`[ProxyGroups] 测试URL: ${url}, 超时: ${timeout}ms`)

      try {
        await Promise.race([
          delayManager.checkListDelay(names, groupName, timeout),
          delayGroup(groupName, url, timeout).then((result) => {
            debugLog(
              `[ProxyGroups] getGroupProxyDelays返回结果数量:`,
              Object.keys(result || {}).length,
            )
          }), // 查询group delays 将清除fixed(不关注调用结果)
        ])
        debugLog(`[ProxyGroups] 延迟测试完成，组: ${groupName}`)
      } catch (error) {
        console.error(`[ProxyGroups] 延迟测试出错，组: ${groupName}`, error)
      } finally {
        const headState = getGroupHeadState(groupName)
        if (headState?.sortType === 1) {
          onHeadState(groupName, { sortType: headState.sortType })
        }
        onProxies()
      }
    }),
  )

  // 滚到对应的节点
  const handleLocation = useStableCallback((group: IProxyGroupItem) => {
    if (!group) return
    const { name, now } = group

    const index = renderList.findIndex(
      (e) =>
        e.group?.name === name &&
        ((e.type === 2 && e.proxy?.name === now) ||
          (e.type === 4 && e.proxyCol?.some((p) => p.name === now))),
    )

    if (index >= 0) {
      virtualizer.scrollToIndex(index, { align: 'center', behavior: 'smooth' })
    }
  })

  // ProxyGroupNavigator 已删除，handleGroupLocationByName + proxyGroupNames 一并清理

  // 当前 renderList 中有效存在的 group name (用于过滤已删除的 pinned)
  const allGroupNames = useMemo(() => {
    const names = new Set<string>()
    for (const item of renderList) {
      if (item.type === 0 && item.group?.name) {
        names.add(item.group.name)
      }
    }
    return names
  }, [renderList])

  // 过滤 pinned: 只保留当前 renderList 里实际存在的 group
  const validPinned = useMemo(
    () => pinnedNames.filter((n) => allGroupNames.has(n)),
    [pinnedNames, allGroupNames],
  )

  const renderProxyList = (height: string) => (
    <ProxyVirtualList
      parentRef={parentRef}
      height={height}
      totalSize={virtualizer.getTotalSize()}
      virtualItems={virtualItems}
      renderList={renderList}
      stickyItem={null}
      indent={mode === 'rule' || mode === 'script'}
      isChainMode={isChainMode}
      measureElement={virtualizer.measureElement}
      onLocation={handleLocation}
      onCheckAll={handleCheckAll}
      onHeadState={onHeadState}
      onChangeProxy={handleChangeProxy}
      pinnedSet={pinnedSet}
      onTogglePin={togglePin}
    />
  )

  // 顶部钉住条
  const renderPinnedBar = () => {
    if (validPinned.length === 0) return null
    return (
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 0.75,
          px: 1.5,
          py: 1,
          borderBottom: '1px solid',
          borderColor: 'var(--md-sys-color-outline-variant)',
          backgroundColor: 'var(--md-sys-color-surface-container-low)',
        }}
      >
        {validPinned.map((name) => (
          <Chip
            key={name}
            label={name}
            size="small"
            onClick={() => jumpToGroup(name)}
            onDelete={() => togglePin(name)}
            sx={{
              borderRadius: '999px',
              fontWeight: 500,
              backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.12),
              color: 'primary.main',
              '&:hover': {
                backgroundColor: (theme) =>
                  alpha(theme.palette.primary.main, 0.2),
              },
              '& .MuiChip-deleteIcon': {
                color: 'primary.main',
                opacity: 0.6,
                '&:hover': { opacity: 1, color: 'primary.main' },
              },
            }}
          />
        ))}
      </Box>
    )
  }

  if (mode === 'direct') {
    return <BaseEmpty textKey="proxies.page.messages.directMode" />
  }

  if (isChainMode) {
    // 获取所有代理组
    const proxyGroups = proxiesData?.groups || []
    const showRuleHeader = mode === 'rule' && proxyGroups.length > 0

    return (
      <>
        <Box sx={{ display: 'flex', height: '100%', gap: 2 }}>
          <Box
            sx={{
              flex: 1,
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
            }}
          >
            {showRuleHeader && (
              <ChainRuleHeader
                title={t('proxies.page.rules.title')}
                selectLabel={t('proxies.page.rules.select')}
                currentGroup={currentGroup}
                canSelectGroup={availableGroups.length > 0}
                onMenuOpen={handleGroupMenuOpen}
              />
            )}

            {renderPinnedBar()}

            <Box sx={{ flex: 1, minHeight: 0, position: 'relative' }}>
              {renderProxyList('100%')}
            </Box>
            <ScrollTopButton show={showScrollTop} onClick={scrollToTop} />
          </Box>

          {/* 右侧链式代理面板：加 mr 让面板不紧贴窗口右边 */}
          <Box sx={{ width: '400px', minWidth: '300px', mr: 1.5 }}>
            <ProxyChain
              proxyChain={proxyChain}
              onUpdateChain={setProxyChain}
              chainConfigData={chainConfigData}
              mode={mode}
              selectedGroup={activeSelectedGroup}
            />
          </Box>
        </Box>

        <Snackbar
          open={duplicateWarning.open}
          autoHideDuration={3000}
          onClose={handleCloseDuplicateWarning}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert
            onClose={handleCloseDuplicateWarning}
            severity="warning"
            variant="filled"
          >
            {duplicateWarning.message}
          </Alert>
        </Snackbar>

        <GroupSelectMenu
          anchorEl={ruleMenuAnchor}
          groups={availableGroups}
          selectedGroup={activeSelectedGroup}
          emptyText="暂无可用代理组"
          onClose={handleGroupMenuClose}
          onSelect={handleGroupSelect}
        />
      </>
    )
  }

  return (
    <div
      style={{
        position: 'relative',
        height: '100%',
        willChange: 'transform',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* 顶部钉住的 group chips */}
      {renderPinnedBar()}
      {/* 列表区 (flex:1 自动填满剩余高度) */}
      <Box sx={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {renderProxyList('100%')}
      </Box>
      <ScrollTopButton show={showScrollTop} onClick={scrollToTop} />
    </div>
  )
}

type VirtualListItem = {
  key: Key
  index: number
  start: number
  end: number
}

interface ProxyVirtualListProps {
  parentRef: RefObject<HTMLDivElement | null>
  height: string
  totalSize: number
  virtualItems: VirtualListItem[]
  renderList: IRenderItem[]
  stickyItem: IRenderItem | null
  indent: boolean
  isChainMode?: boolean
  measureElement: (node: Element | null) => void
  onLocation: (group: IRenderItem['group']) => void
  onCheckAll: (groupName: string) => void
  onHeadState: (groupName: string, patch: Partial<HeadState>) => void
  onChangeProxy: (
    group: IRenderItem['group'],
    proxy: IRenderItem['proxy'] & { name: string },
  ) => void
  pinnedSet?: Set<string>
  onTogglePin?: (groupName: string) => void
}

interface ProxyGroupOption {
  name: string
  type: string
  all?: unknown[]
}

interface ChainRuleHeaderProps {
  title: string
  selectLabel: string
  currentGroup: ProxyGroupOption | null
  canSelectGroup: boolean
  onMenuOpen: (event: MouseEvent<HTMLElement>) => void
}

function ChainRuleHeader({
  title,
  selectLabel,
  currentGroup,
  canSelectGroup,
  onMenuOpen,
}: ChainRuleHeaderProps) {
  return (
    <Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '16px' }}>
            {title}
          </Typography>

          {currentGroup && (
            <Chip
              size="small"
              label={`${currentGroup.name} (${currentGroup.type})`}
              variant="outlined"
              sx={{
                fontSize: '12px',
                maxWidth: '200px',
                '& .MuiChip-label': {
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                },
              }}
            />
          )}
        </Box>

        {canSelectGroup && (
          <IconButton
            size="small"
            onClick={onMenuOpen}
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: '4px',
              padding: '4px 8px',
            }}
          >
            <Typography variant="body2" sx={{ mr: 0.5, fontSize: '12px' }}>
              {selectLabel}
            </Typography>
            <ExpandMoreRounded fontSize="small" />
          </IconButton>
        )}
      </Box>
    </Box>
  )
}

interface GroupSelectMenuProps {
  anchorEl: HTMLElement | null
  groups: ProxyGroupOption[]
  selectedGroup: string | null
  emptyText: string
  onClose: () => void
  onSelect: (groupName: string) => void
}

function GroupSelectMenu({
  anchorEl,
  groups,
  selectedGroup,
  emptyText,
  onClose,
  onSelect,
}: GroupSelectMenuProps) {
  return (
    <Menu
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            maxHeight: 300,
            minWidth: 200,
          },
        },
      }}
    >
      {groups.map((group) => (
        <MenuItem
          key={group.name}
          onClick={() => onSelect(group.name)}
          selected={selectedGroup === group.name}
          sx={{ fontSize: '14px', py: 1 }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {group.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {group.type} · {group.all?.length ?? 0} 节点
            </Typography>
          </Box>
        </MenuItem>
      ))}

      {groups.length === 0 && (
        <MenuItem disabled>
          <Typography variant="body2" color="text.secondary">
            {emptyText}
          </Typography>
        </MenuItem>
      )}
    </Menu>
  )
}

function ProxyVirtualList({
  parentRef,
  height,
  totalSize,
  virtualItems,
  renderList,
  stickyItem,
  indent,
  isChainMode,
  measureElement,
  onLocation,
  onCheckAll,
  onHeadState,
  onChangeProxy,
  pinnedSet,
  onTogglePin,
}: ProxyVirtualListProps) {
  // unused params (kept for future virtualization re-enable)
  void totalSize
  void virtualItems
  void measureElement
  return (
    <div ref={parentRef} style={{ height, overflow: 'auto' }}>
      {stickyItem && (
        <Box
          sx={{
            position: 'sticky',
            top: 0,
            height: 0,
            zIndex: 5,
            pointerEvents: 'none',
          }}
        >
          <Box
            sx={{
              pointerEvents: 'auto',
              '& .MuiListItemButton-root': {
                boxShadow: 3,
              },
            }}
          >
            <ProxyRender
              item={stickyItem}
              indent={indent}
              onLocation={onLocation}
              onCheckAll={onCheckAll}
              onHeadState={onHeadState}
              onChangeProxy={onChangeProxy}
              isChainMode={isChainMode}
            />
          </Box>
        </Box>
      )}

      {/* 关掉虚拟化 —— 改用普通 DOM flow 渲染全部 items
          这样点 chevron 折叠/展开时，下方内容靠浏览器自然 reflow 挤下去
          不再有 transform 跳变，但代价是节点 >500 时滚动可能略卡 */}
      <div style={{ position: 'relative' }}>
        {renderList.map((item, index) => {
          // 只在 group 头 (type 0) 上加 data-group, 用于 jumpToGroup 定位
          const groupName = item.type === 0 ? item.group?.name : undefined
          const isPinned = !!(groupName && pinnedSet?.has(groupName))
          return (
            <div
              key={item.key ?? index}
              data-index={index}
              {...(groupName ? { 'data-group': groupName } : {})}
            >
            <ProxyRender
              item={item}
              indent={indent}
              onLocation={onLocation}
              onCheckAll={onCheckAll}
              onHeadState={onHeadState}
              onChangeProxy={onChangeProxy}
              isChainMode={isChainMode}
              isPinned={isPinned}
              onTogglePin={onTogglePin}
            />
            </div>
          )
        })}
        <div style={{ height: 8 }} />
      </div>
    </div>
  )
}

function getStickyGroupByIndex(renderList: IRenderItem[]) {
  let stickyGroup: IRenderItem | null = null

  return renderList.map((item) => {
    if (item?.type === 0 && item.group && !item.group.hidden) {
      stickyGroup = item
    }
    return stickyGroup
  })
}

function getStickyGroupItem(
  stickyGroupByIndex: (IRenderItem | null)[],
  virtualItems: VirtualListItem[],
  scrollTop: number,
) {
  const firstVisibleItem =
    virtualItems.find((item) => item.end > scrollTop + 1) ?? virtualItems[0]

  if (!firstVisibleItem) return null

  return stickyGroupByIndex[firstVisibleItem.index] ?? null
}

// 替换简单防抖函数为更优的节流函数
function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  let previous = 0

  return function (...args: Parameters<T>) {
    const now = Date.now()
    const remaining = wait - (now - previous)

    if (remaining <= 0 || remaining > wait) {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      previous = now
      func(...args)
    } else if (!timer) {
      timer = setTimeout(() => {
        previous = Date.now()
        timer = null
        func(...args)
      }, remaining)
    }
  }
}
