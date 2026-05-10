import {
  alpha,
  type Components,
  createTheme,
  type Theme as MuiTheme,
  type Shadows,
} from '@mui/material'
import {
  getCurrentWebviewWindow,
  WebviewWindow,
} from '@tauri-apps/api/webviewWindow'
import { Theme as TauriOsTheme } from '@tauri-apps/api/window'
import { useEffect, useMemo } from 'react'

import { useVerge } from '@/hooks/use-verge'
import { defaultDarkTheme, defaultTheme } from '@/pages/_theme'
import { useSetThemeMode, useThemeMode } from '@/services/states'

// ----- Material Design 3 主题工具 -----

// MD3 surface-container 5 级 baseline 颜色
// 参考: https://m3.material.io/styles/color/the-color-system/color-roles
// 通过 CSS variable 暴露，组件用 var(--md-sys-color-surface-container-low) 引用
const MD3_SURFACE_LIGHT = {
  surfaceDim: '#DED8E1',
  surface: '#FEF7FF',
  surfaceBright: '#FEF7FF',
  surfaceContainerLowest: '#FFFFFF',
  surfaceContainerLow: '#F7F2FA',
  surfaceContainer: '#F3EDF7',
  surfaceContainerHigh: '#ECE6F0',
  surfaceContainerHighest: '#E6E0E9',
  outline: '#79747E',
  outlineVariant: '#CAC4D0',
} as const

const MD3_SURFACE_DARK = {
  surfaceDim: '#141218',
  surface: '#141218',
  surfaceBright: '#3B383E',
  surfaceContainerLowest: '#0F0D13',
  surfaceContainerLow: '#1D1B20',
  surfaceContainer: '#211F26',
  surfaceContainerHigh: '#2B2930',
  surfaceContainerHighest: '#36343B',
  outline: '#938F99',
  outlineVariant: '#49454F',
} as const

const md3SurfaceFor = (mode: 'light' | 'dark') =>
  mode === 'light' ? MD3_SURFACE_LIGHT : MD3_SURFACE_DARK

// MD3 state layer 透明度 spec
// hover 8% / focus 10% / pressed 10% / dragged 16%
const MD3_STATE_LAYER = {
  hover: 0.08,
  focus: 0.1,
  pressed: 0.1,
  dragged: 0.16,
} as const

// MD3 elevation tokens —— level 1~5 来自 spec 的 dp 阴影换算
// 参考: https://m3.material.io/styles/elevation/tokens
const buildMd3Shadows = (mode: 'light' | 'dark'): Shadows => {
  const isDark = mode === 'dark'
  // 暗色模式下阴影更深
  const keyA = isDark ? 0.36 : 0.16
  const keyB = isDark ? 0.28 : 0.12
  const ambientA = isDark ? 0.22 : 0.08
  const ambientB = isDark ? 0.16 : 0.06

  // MD3 5 档 elevation (1dp / 3dp / 6dp / 8dp / 12dp)
  const elevations: string[] = [
    'none',
    `0 1px 2px 0 rgba(0,0,0,${keyA}), 0 1px 3px 1px rgba(0,0,0,${ambientA})`, // 1
    `0 1px 2px 0 rgba(0,0,0,${keyA}), 0 2px 6px 2px rgba(0,0,0,${ambientA})`, // 2
    `0 4px 8px 3px rgba(0,0,0,${ambientA}), 0 1px 3px 0 rgba(0,0,0,${keyA})`, // 3
    `0 6px 10px 4px rgba(0,0,0,${ambientB}), 0 2px 3px 0 rgba(0,0,0,${keyA})`, // 4
    `0 8px 12px 6px rgba(0,0,0,${ambientB}), 0 4px 4px 0 rgba(0,0,0,${keyB})`, // 5
  ]

  // 第 6 档及以上线性插值，保证 25 项填满
  const shadows: string[] = [...elevations]
  for (let i = elevations.length; i < 25; i += 1) {
    const scale = 1 + (i - 5) * 0.4
    const blur = Math.round(12 * scale)
    const spread = Math.round(6 * scale)
    const offset = Math.round(8 * scale)
    shadows.push(
      `0 ${offset}px ${blur}px ${spread}px rgba(0,0,0,${ambientB}), ` +
        `0 ${Math.max(2, Math.round(offset / 4))}px ${Math.round(
          blur / 3,
        )}px 0 rgba(0,0,0,${keyB})`,
    )
  }
  return shadows as Shadows
}

// MD3 组件 override —— 圆角 / state layer / surface-container 集成
const buildMd3Components = (
  mode: 'light' | 'dark',
  primaryMain: string,
): Components<MuiTheme> => {
  const isDark = mode === 'dark'
  // MD3 spec: state layer 颜色继承自 currentColor (on-surface 等)，透明度固定
  // hover 8% / focus 10% / pressed 10%
  const onSurfaceHover = alpha(isDark ? '#FFFFFF' : '#000000', MD3_STATE_LAYER.hover)
  const onSurfaceFocus = alpha(isDark ? '#FFFFFF' : '#000000', MD3_STATE_LAYER.focus)
  const primaryHover = alpha(primaryMain, MD3_STATE_LAYER.hover)
  const primaryFocus = alpha(primaryMain, MD3_STATE_LAYER.focus)

  // MD3 elevation transition curve
  const md3Easing = 'cubic-bezier(0.2, 0, 0, 1)'
  const md3Duration = '180ms'

  return {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          fontFeatureSettings: '"cv11", "ss01", "ss03"',
          fontOpticalSizing: 'auto',
          textRendering: 'optimizeLegibility',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 999, // MD3 按钮: 全 pill
          textTransform: 'none',
          fontWeight: 500,
          letterSpacing: '0.0125em',
          paddingInline: 24,
          minHeight: 40,
          transition: `background-color ${md3Duration} ${md3Easing}, box-shadow ${md3Duration} ${md3Easing}`,
        },
        sizeSmall: { minHeight: 32, paddingInline: 16 },
        sizeLarge: { minHeight: 48, paddingInline: 28 },
        contained: {
          '&:hover': {
            // MD3 filled button hover 加 elevation level-1 + on-primary state layer
            boxShadow: '0 1px 2px 0 rgba(0,0,0,0.30), 0 1px 3px 1px rgba(0,0,0,0.15)',
          },
        },
        outlined: {
          borderColor: isDark ? MD3_SURFACE_DARK.outline : MD3_SURFACE_LIGHT.outline,
          '&:hover': { backgroundColor: primaryHover },
        },
        text: {
          '&:hover': { backgroundColor: primaryHover },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          transition: `background-color ${md3Duration} ${md3Easing}`,
          '&:hover': { backgroundColor: onSurfaceHover },
          '&:focus-visible': { backgroundColor: onSurfaceFocus },
        },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          borderRadius: 16,
        },
        rounded: { borderRadius: 16 },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          // MD3 filled card: surface-container-low 背景，无阴影
          borderRadius: 12,
          backgroundColor: 'var(--md-sys-color-surface-container-low)',
          backgroundImage: 'none',
          transition: `background-color ${md3Duration} ${md3Easing}, box-shadow ${md3Duration} ${md3Easing}`,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          // MD3 dialog: 28dp 圆角 + surface-container-high 背景
          borderRadius: 28,
          backgroundColor: 'var(--md-sys-color-surface-container-high)',
          backgroundImage: 'none',
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: 12,
          backgroundColor: 'var(--md-sys-color-surface-container)',
          backgroundImage: 'none',
        },
        list: { paddingBlock: 8 },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          marginInline: 8,
          minHeight: 44,
          '&:hover': { backgroundColor: onSurfaceHover },
          '&.Mui-selected': {
            backgroundColor: alpha(primaryMain, 0.12),
            '&:hover': { backgroundColor: alpha(primaryMain, 0.16) },
          },
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          '&:hover': { backgroundColor: onSurfaceHover },
          '&.Mui-selected': {
            backgroundColor: alpha(primaryMain, 0.12),
            '&:hover': { backgroundColor: alpha(primaryMain, 0.16) },
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 500,
          height: 32,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          // MD3 text field 实际是 4dp 顶圆角，但桌面 GUI 用 12dp 整圆角更现代
          borderRadius: 12,
        },
        notchedOutline: {
          borderColor: isDark ? MD3_SURFACE_DARK.outline : MD3_SURFACE_LIGHT.outline,
        },
      },
    },
    MuiTextField: {
      defaultProps: { variant: 'outlined' },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          borderRadius: 4,
          fontSize: 11,
          fontWeight: 500,
          paddingBlock: 4,
          paddingInline: 8,
          backgroundColor: isDark ? '#E6E0E9' : '#322F35',
          color: isDark ? '#322F35' : '#F5EFF7',
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        root: { padding: 8 },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          height: 3,
          borderRadius: '3px 3px 0 0',
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          minHeight: 48,
          letterSpacing: '0.006em',
          '&:hover': { backgroundColor: primaryHover },
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: isDark
            ? MD3_SURFACE_DARK.outlineVariant
            : MD3_SURFACE_LIGHT.outlineVariant,
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          height: 4,
        },
      },
    },
  }
}

const CSS_INJECTION_SCOPE_ROOT = '[data-css-injection-root]'
const CSS_INJECTION_SCOPE_LIMIT =
  ':is(.monaco-editor .view-lines, .monaco-editor .view-line, .monaco-editor .margin, .monaco-editor .margin-view-overlays, .monaco-editor .view-overlays, .monaco-editor [class^="mtk"], .monaco-editor [class*=" mtk"])'
const TOP_LEVEL_AT_RULES = [
  '@charset',
  '@import',
  '@namespace',
  '@font-face',
  '@keyframes',
  '@counter-style',
  '@page',
  '@property',
  '@font-feature-values',
  '@color-profile',
]
let cssScopeSupport: boolean | null = null

const canUseCssScope = () => {
  if (cssScopeSupport !== null) {
    return cssScopeSupport
  }
  try {
    const testStyle = document.createElement('style')
    testStyle.textContent = '@scope (:root) { }'
    document.head.appendChild(testStyle)
    cssScopeSupport = !!testStyle.sheet?.cssRules?.length
    document.head.removeChild(testStyle)
  } catch {
    cssScopeSupport = false
  }
  return cssScopeSupport
}

const wrapCssInjectionWithScope = (css?: string) => {
  if (!css?.trim()) {
    return ''
  }
  const lowerCss = css.toLowerCase()
  const hasTopLevelOnlyRule = TOP_LEVEL_AT_RULES.some((rule) =>
    lowerCss.includes(rule),
  )
  if (hasTopLevelOnlyRule) {
    return null
  }
  const scopeRoot = CSS_INJECTION_SCOPE_ROOT
  const scopeLimit = CSS_INJECTION_SCOPE_LIMIT
  const scopedBlock = `@scope (${scopeRoot}) to (${scopeLimit}) {
${css}
}`
  return scopedBlock
}

/**
 * custom theme
 */
export const useCustomTheme = () => {
  const appWindow: WebviewWindow = useMemo(() => getCurrentWebviewWindow(), [])
  const { verge } = useVerge()
  const { theme_mode, theme_setting } = verge ?? {}
  const mode = useThemeMode()
  const setMode = useSetThemeMode()
  const userBackgroundImage = theme_setting?.background_image || ''
  const hasUserBackground = !!userBackgroundImage

  useEffect(() => {
    if (theme_mode === 'light' || theme_mode === 'dark') {
      setMode(theme_mode)
    }
  }, [theme_mode, setMode])

  useEffect(() => {
    if (theme_mode !== 'system') {
      return
    }

    let isMounted = true

    const timerId = setTimeout(() => {
      if (!isMounted) return
      appWindow
        .theme()
        .then((systemTheme) => {
          if (isMounted && systemTheme) {
            setMode(systemTheme)
          }
        })
        .catch((err) => {
          console.error('Failed to get initial system theme:', err)
        })
    }, 0)

    const unlistenPromise = appWindow.onThemeChanged(({ payload }) => {
      if (isMounted) {
        setMode(payload)
      }
    })

    return () => {
      isMounted = false
      clearTimeout(timerId)
      unlistenPromise
        .then((unlistenFn) => {
          if (typeof unlistenFn === 'function') {
            unlistenFn()
          }
        })
        .catch((err) => {
          console.error('Failed to unlisten from theme changes:', err)
        })
    }
  }, [theme_mode, appWindow, setMode])

  useEffect(() => {
    if (theme_mode === undefined) {
      return
    }

    if (theme_mode === 'system') {
      appWindow.setTheme(null).catch((err) => {
        console.error(
          'Failed to set window theme to follow system (setTheme(null)):',
          err,
        )
      })
    } else if (mode) {
      appWindow.setTheme(mode as TauriOsTheme).catch((err) => {
        console.error(`Failed to set window theme to ${mode}:`, err)
      })
    }
  }, [mode, appWindow, theme_mode])

  const theme = useMemo(() => {
    const setting = theme_setting || {}
    const dt = mode === 'light' ? defaultTheme : defaultDarkTheme
    let muiTheme: MuiTheme

    // 拿到最终的 primary 主色，用于 surface tint / state layer 计算
    const resolvedPrimary = setting.primary_color || dt.primary_color
    const resolvedFontFamily = setting.font_family
      ? `${setting.font_family}, ${dt.font_family}`
      : dt.font_family

    // MD3 typography scale —— 严格按 Material 3 spec
    // https://m3.material.io/styles/typography/type-scale-tokens
    // (Display/Headline/Title/Body/Label) → MUI 槽位映射
    const md3Typography = {
      fontFamily: resolvedFontFamily,
      fontWeightLight: 300,
      fontWeightRegular: 400,
      fontWeightMedium: 500,
      fontWeightBold: 700,
      // Display Large 57/64/-0.25
      h1: {
        fontSize: '3.5625rem',
        fontWeight: 400,
        lineHeight: 1.12,
        letterSpacing: '-0.015625em',
      },
      // Display Medium 45/52/0
      h2: {
        fontSize: '2.8125rem',
        fontWeight: 400,
        lineHeight: 1.156,
        letterSpacing: 0,
      },
      // Display Small 36/44/0
      h3: {
        fontSize: '2.25rem',
        fontWeight: 400,
        lineHeight: 1.222,
        letterSpacing: 0,
      },
      // Headline Medium 28/36/0
      h4: {
        fontSize: '1.75rem',
        fontWeight: 500,
        lineHeight: 1.286,
        letterSpacing: 0,
      },
      // Headline Small 24/32/0
      h5: {
        fontSize: '1.5rem',
        fontWeight: 500,
        lineHeight: 1.333,
        letterSpacing: 0,
      },
      // Title Large 22/28/0
      h6: {
        fontSize: '1.375rem',
        fontWeight: 500,
        lineHeight: 1.273,
        letterSpacing: 0,
      },
      // Title Medium 16/24/0.15
      subtitle1: {
        fontSize: '1rem',
        fontWeight: 500,
        lineHeight: 1.5,
        letterSpacing: '0.009375em',
      },
      // Title Small 14/20/0.1
      subtitle2: {
        fontSize: '0.875rem',
        fontWeight: 500,
        lineHeight: 1.429,
        letterSpacing: '0.00714em',
      },
      // Body Large 16/24/0.5
      body1: {
        fontSize: '1rem',
        fontWeight: 400,
        lineHeight: 1.5,
        letterSpacing: '0.03125em',
      },
      // Body Medium 14/20/0.25
      body2: {
        fontSize: '0.875rem',
        fontWeight: 400,
        lineHeight: 1.429,
        letterSpacing: '0.01786em',
      },
      // Label Large 14/20/0.1 medium
      button: {
        fontSize: '0.875rem',
        fontWeight: 500,
        lineHeight: 1.429,
        letterSpacing: '0.00714em',
        textTransform: 'none' as const,
      },
      // Body Small 12/16/0.4
      caption: {
        fontSize: '0.75rem',
        fontWeight: 400,
        lineHeight: 1.333,
        letterSpacing: '0.03333em',
      },
      // Label Small 11/16/0.5 medium
      overline: {
        fontSize: '0.6875rem',
        fontWeight: 500,
        lineHeight: 1.455,
        letterSpacing: '0.04545em',
        textTransform: 'uppercase' as const,
      },
    }

    try {
      muiTheme = createTheme({
        breakpoints: {
          values: { xs: 0, sm: 650, md: 900, lg: 1200, xl: 1536 },
        },
        shape: { borderRadius: 12 }, // MD3 medium 默认圆角
        palette: {
          mode,
          primary: { main: resolvedPrimary },
          secondary: { main: setting.secondary_color || dt.secondary_color },
          info: { main: setting.info_color || dt.info_color },
          error: { main: setting.error_color || dt.error_color },
          warning: { main: setting.warning_color || dt.warning_color },
          success: { main: setting.success_color || dt.success_color },
          text: {
            primary: setting.primary_text || dt.primary_text,
            secondary: setting.secondary_text || dt.secondary_text,
          },
          background: {
            paper: dt.background_color,
            default: dt.background_color,
          },
        },
        shadows: buildMd3Shadows(mode),
        typography: md3Typography,
        components: buildMd3Components(mode, resolvedPrimary),
      })
    } catch (e) {
      console.error('Error creating MUI theme, falling back to defaults:', e)
      muiTheme = createTheme({
        breakpoints: {
          values: { xs: 0, sm: 650, md: 900, lg: 1200, xl: 1536 },
        },
        shape: { borderRadius: 12 },
        palette: {
          mode,
          primary: { main: dt.primary_color },
          secondary: { main: dt.secondary_color },
          info: { main: dt.info_color },
          error: { main: dt.error_color },
          warning: { main: dt.warning_color },
          success: { main: dt.success_color },
          text: { primary: dt.primary_text, secondary: dt.secondary_text },
          background: {
            paper: dt.background_color,
            default: dt.background_color,
          },
        },
        shadows: buildMd3Shadows(mode),
        typography: md3Typography,
        components: buildMd3Components(mode, dt.primary_color),
      })
    }

    const rootEle = document.documentElement
    if (rootEle) {
      const backgroundColor = mode === 'light' ? '#ECECEC' : dt.background_color
      const selectColor = mode === 'light' ? '#f5f5f5' : '#3E3E3E'
      const scrollColor = mode === 'light' ? '#90939980' : '#555555'
      const dividerColor =
        mode === 'light' ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.06)'
      rootEle.style.setProperty('--divider-color', dividerColor)
      rootEle.style.setProperty('--background-color', backgroundColor)
      rootEle.style.setProperty('--selection-color', selectColor)
      rootEle.style.setProperty('--scroller-color', scrollColor)
      rootEle.style.setProperty('--primary-main', muiTheme.palette.primary.main)
      rootEle.style.setProperty(
        '--background-color-alpha',
        alpha(muiTheme.palette.primary.main, 0.1),
      )
      rootEle.style.setProperty(
        '--window-border-color',
        mode === 'light' ? '#cccccc' : '#1E1E1E',
      )
      rootEle.style.setProperty(
        '--scrollbar-bg',
        mode === 'light' ? '#f1f1f1' : '#2E303D',
      )
      rootEle.style.setProperty(
        '--scrollbar-thumb',
        mode === 'light' ? '#c1c1c1' : '#555555',
      )
      rootEle.style.setProperty(
        '--user-background-image',
        hasUserBackground ? `url('${userBackgroundImage}')` : 'none',
      )
      rootEle.style.setProperty(
        '--background-blend-mode',
        setting.background_blend_mode || 'normal',
      )
      rootEle.style.setProperty(
        '--background-opacity',
        setting.background_opacity !== undefined
          ? String(setting.background_opacity)
          : '1',
      )
      rootEle.setAttribute('data-css-injection-root', 'true')
    }

    let styleElement = document.querySelector('style#verge-theme')
    if (!styleElement) {
      styleElement = document.createElement('style')
      styleElement.id = 'verge-theme'
      document.head.appendChild(styleElement!)
    }

    if (styleElement) {
      let scopedCss: string | null = null
      if (canUseCssScope() && setting.css_injection) {
        scopedCss = wrapCssInjectionWithScope(setting.css_injection)
      }
      const effectiveInjectedCss = scopedCss ?? setting.css_injection ?? ''
      // MD3 surface-container 5 级 —— 注入到 :root 让所有组件都能引用
      const surf = md3SurfaceFor(mode)
      const md3CssVars = `
        :root {
          --md-sys-color-surface-dim: ${surf.surfaceDim};
          --md-sys-color-surface: ${surf.surface};
          --md-sys-color-surface-bright: ${surf.surfaceBright};
          --md-sys-color-surface-container-lowest: ${surf.surfaceContainerLowest};
          --md-sys-color-surface-container-low: ${surf.surfaceContainerLow};
          --md-sys-color-surface-container: ${surf.surfaceContainer};
          --md-sys-color-surface-container-high: ${surf.surfaceContainerHigh};
          --md-sys-color-surface-container-highest: ${surf.surfaceContainerHighest};
          --md-sys-color-outline: ${surf.outline};
          --md-sys-color-outline-variant: ${surf.outlineVariant};
        }
      `

      const globalStyles = `
        ${md3CssVars}

        /* MD3 圆润胶囊滚动条 */
        ::-webkit-scrollbar {
          width: 12px;
          height: 12px;
          background-color: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background-color: var(--scrollbar-thumb);
          border-radius: 999px;
          border: 3px solid transparent;
          background-clip: content-box;
          transition: background-color 180ms cubic-bezier(0.2, 0, 0, 1);
        }
        ::-webkit-scrollbar-thumb:hover {
          background-color: ${mode === 'light' ? '#7d7d7d' : '#888888'};
          background-clip: content-box;
        }
        ::-webkit-scrollbar-corner {
          background-color: transparent;
        }

        /* 背景图处理 */
        body {
          background-color: var(--background-color);
          ${
            hasUserBackground
              ? `
            background-image: var(--user-background-image);
            background-size: cover;
            background-position: center;
            background-attachment: fixed;
            background-blend-mode: var(--background-blend-mode);
            opacity: var(--background-opacity);
          `
              : ''
          }
        }

        /* 仅去掉默认 outline，保留 :focus-visible 键盘焦点环 */
        *:focus:not(:focus-visible) {
          outline: none;
        }
      `

      styleElement.innerHTML = effectiveInjectedCss + globalStyles
    }

    return muiTheme
  }, [mode, theme_setting, userBackgroundImage, hasUserBackground])

  useEffect(() => {
    const id = setTimeout(() => {
      const dom = document.querySelector('#Gradient2')
      if (dom) {
        dom.innerHTML = `
        <stop offset="0%" stop-color="${theme.palette.primary.main}" />
        <stop offset="80%" stop-color="${theme.palette.primary.dark}" />
        <stop offset="100%" stop-color="${theme.palette.primary.dark}" />
        `
      }
    }, 0)
    return () => clearTimeout(id)
  }, [theme.palette.primary.main, theme.palette.primary.dark])

  return { theme }
}
