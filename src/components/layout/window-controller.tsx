import {
  Close,
  CropSquare,
  FilterNone,
  HorizontalRule,
} from '@mui/icons-material'
import { Box, IconButton } from '@mui/material'
import { forwardRef, useImperativeHandle } from 'react'

import { useWindowControls } from '@/hooks/use-window'
import getSystem from '@/utils/get-system'

export const WindowControls = forwardRef(function WindowControls(props, ref) {
  const OS = getSystem()
  const {
    currentWindow,
    maximized,
    minimize,
    close,
    toggleFullscreen,
    toggleMaximize,
  } = useWindowControls()

  useImperativeHandle(
    ref,
    () => ({
      currentWindow,
      maximized,
      minimize,
      close,
      toggleFullscreen,
      toggleMaximize,
    }),
    [
      currentWindow,
      maximized,
      minimize,
      close,
      toggleFullscreen,
      toggleMaximize,
    ],
  )

  // 通过前端对 tauri 窗口进行翻转全屏时会短暂地与系统图标重叠渲染。
  // 这可能是上游缺陷，保险起见跨平台以窗口的最大化翻转为准。

  // Windows 11 标准 close hover 红 #C42B1C (Microsoft Fluent UI Accent.Color.10)
  const winCloseRed = '#C42B1C'
  // 通用窗口控制按钮样式：hover 用 on-surface 8% state layer
  const ctrlBtnSx = {
    width: 32,
    height: 32,
    borderRadius: '8px', // Win11 圆角风格而不是全圆
    fontSize: 16,
    color: 'text.secondary',
    transition: 'background-color 150ms cubic-bezier(0.2,0,0,1), color 150ms',
    '&:hover': {
      backgroundColor: 'rgba(0,0,0,0.06)',
      color: 'text.primary',
    },
  }
  const ctrlCloseSx = {
    ...ctrlBtnSx,
    '&:hover': {
      backgroundColor: winCloseRed,
      color: '#FFFFFF',
    },
  }
  // macOS 信号灯样式：彩色圆点
  const macTrafficLight = (bg: string, hoverBg: string) => ({
    width: 12,
    height: 12,
    borderRadius: '50%',
    padding: 0,
    minWidth: 12,
    backgroundColor: bg,
    transition: 'background-color 150ms cubic-bezier(0.2,0,0,1)',
    '& svg': { opacity: 0, fontSize: 10, color: 'rgba(0,0,0,0.6)' },
    '&:hover': {
      backgroundColor: hoverBg,
      '& svg': { opacity: 1 },
    },
  })

  return (
    <Box
      sx={{
        display: 'flex',
        gap: OS === 'macos' ? 1 : 0.5,
        alignItems: 'center',
        '> button': { cursor: 'pointer' },
      }}
    >
      {OS === 'macos' && (
        <>
          {/* macOS 信号灯：红 → 黄 → 绿 */}
          <IconButton size="small" sx={macTrafficLight('#FF5F57', '#E0443E')} onClick={close}>
            <Close fontSize="inherit" />
          </IconButton>
          <IconButton size="small" sx={macTrafficLight('#FEBC2E', '#DEA123')} onClick={minimize}>
            <HorizontalRule fontSize="inherit" />
          </IconButton>
          <IconButton size="small" sx={macTrafficLight('#28C840', '#1AAB29')} onClick={toggleMaximize}>
            {maximized ? <FilterNone fontSize="inherit" /> : <CropSquare fontSize="inherit" />}
          </IconButton>
        </>
      )}

      {(OS === 'windows' || OS === 'linux' || OS === 'unknown') && (
        <>
          {/* Win/Linux: 最小化 → 最大化 → 关闭 */}
          <IconButton size="small" sx={ctrlBtnSx} onClick={minimize}>
            <HorizontalRule fontSize="inherit" />
          </IconButton>
          <IconButton size="small" sx={ctrlBtnSx} onClick={toggleMaximize}>
            {maximized ? <FilterNone fontSize="inherit" /> : <CropSquare fontSize="inherit" />}
          </IconButton>
          <IconButton size="small" sx={ctrlCloseSx} onClick={close}>
            <Close fontSize="inherit" />
          </IconButton>
        </>
      )}
    </Box>
  )
})
