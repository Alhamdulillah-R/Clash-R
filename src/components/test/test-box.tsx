import { alpha, Box, styled } from '@mui/material'

export const TestBox = styled(Box)(({ theme, 'aria-selected': selected }) => {
  const { mode, primary, text } = theme.palette
  const key = `${mode}-${!!selected}`

  const color = {
    'light-true': text.secondary,
    'light-false': text.secondary,
    'dark-true': alpha(text.secondary, 0.65),
    'dark-false': alpha(text.secondary, 0.65),
  }[key]!

  const h2color = {
    'light-true': primary.main,
    'light-false': text.primary,
    'dark-true': primary.main,
    'dark-false': text.primary,
  }[key]!

  return {
    position: 'relative',
    width: '100%',
    display: 'block',
    cursor: 'pointer',
    textAlign: 'left',
    // MD3 风格容器：surface-container-low 浅一阶 + outline-variant 1px 边框
    // 不再用 boxShadow（之前跟父 EnhancedCard 的 border 视觉重叠）
    borderRadius: 12,
    border: '1px solid var(--md-sys-color-outline-variant)',
    backgroundColor: 'var(--md-sys-color-surface-container-low)',
    boxShadow: 'none',
    padding: '10px 14px',
    boxSizing: 'border-box',
    color,
    '& h2': { color: h2color },
    transition:
      'background-color 180ms cubic-bezier(0.2,0,0,1), border-color 180ms cubic-bezier(0.2,0,0,1)',
    '&:hover': {
      // hover 时升一阶到 surface-container-high + 主色描边
      backgroundColor: 'var(--md-sys-color-surface-container-high)',
      borderColor: alpha(primary.main, 0.4),
      boxShadow: 'none',
    },
  }
})
