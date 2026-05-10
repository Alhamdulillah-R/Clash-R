import { DeveloperBoardOutlined, EditOutlined } from '@mui/icons-material'
import {
  Divider,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import { useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { ClashPortViewer } from '@/components/setting/mods/clash-port-viewer'
import { useClash } from '@/hooks/use-clash'
import {
  useClashConfigData,
  useRulesData,
  useSystemData,
  useUptimeData,
} from '@/providers/app-data-context'

import { EnhancedCard } from './enhanced-card'

interface PortViewerHandle {
  open: () => void
  close: () => void
}

// 将毫秒转换为时:分:秒格式的函数
const formatUptime = (uptimeMs: number) => {
  const hours = Math.floor(uptimeMs / 3600000)
  const minutes = Math.floor((uptimeMs % 3600000) / 60000)
  const seconds = Math.floor((uptimeMs % 60000) / 1000)
  return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

export const ClashInfoCard = () => {
  const { t } = useTranslation()
  const { version: clashVersion } = useClash()
  const { clashConfig } = useClashConfigData()
  const { rules } = useRulesData()
  const { uptime } = useUptimeData()
  const { systemProxyAddress } = useSystemData()

  // ClashPortViewer 用 imperative ref 控制开关，本地挂一份避免依赖 setting 页
  const portViewerRef = useRef<PortViewerHandle>(null)

  // 使用useMemo缓存格式化后的uptime，避免频繁计算
  const formattedUptime = useMemo(() => formatUptime(uptime), [uptime])

  // 使用备忘录组件内容，减少重新渲染
  const cardContent = useMemo(() => {
    if (!clashConfig) return null

    return (
      <Stack spacing={1.5}>
        <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
          <Typography variant="body2" color="text.secondary">
            {t('home.components.clashInfo.fields.coreVersion')}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
            {clashVersion || '-'}
          </Typography>
        </Stack>
        <Divider />
        <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
          <Typography variant="body2" color="text.secondary">
            {t('home.components.clashInfo.fields.systemProxyAddress')}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
            {systemProxyAddress}
          </Typography>
        </Stack>
        <Divider />
        <Stack
          direction="row"
          sx={{ justifyContent: 'space-between', alignItems: 'center' }}
        >
          <Typography variant="body2" color="text.secondary">
            {t('home.components.clashInfo.fields.mixedPort')}
          </Typography>
          <Stack direction="row" sx={{ alignItems: 'center' }} spacing={0.5}>
            <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
              {clashConfig.mixedPort || '-'}
            </Typography>
            <Tooltip title={t('settings.modals.clashPort.title')}>
              <IconButton
                size="small"
                onClick={() => portViewerRef.current?.open()}
                sx={{ ml: 0.5, p: 0.5 }}
                aria-label={t('settings.modals.clashPort.title')}
              >
                <EditOutlined fontSize="inherit" sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
        <Divider />
        <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
          <Typography variant="body2" color="text.secondary">
            {t('home.components.clashInfo.fields.uptime')}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
            {formattedUptime}
          </Typography>
        </Stack>
        <Divider />
        <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
          <Typography variant="body2" color="text.secondary">
            {t('home.components.clashInfo.fields.rulesCount')}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
            {rules.length}
          </Typography>
        </Stack>
      </Stack>
    )
  }, [
    clashConfig,
    clashVersion,
    t,
    formattedUptime,
    rules.length,
    systemProxyAddress,
  ])

  return (
    <>
      <EnhancedCard
        title={t('home.components.clashInfo.title')}
        icon={<DeveloperBoardOutlined />}
        iconColor="warning"
        action={null}
      >
        {cardContent}
      </EnhancedCard>
      {/* 挂在卡片旁边，imperative open()。点击 mixed-port 行的铅笔按钮触发 */}
      <ClashPortViewer ref={portViewerRef} />
    </>
  )
}
