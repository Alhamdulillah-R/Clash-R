import { alpha, Box, styled } from '@mui/material'

// MD3 + rex 风格订阅卡片
// - 未选中: surface-container-low + outline-variant 1px border
// - 选中:   primary container 软底 + 5px 主色左条 (rex 标志风格)
// - hover:  state-layer (on-surface 8% 在浅色 / 4% 在暗)
// - 入场: card-float-in 动画 (定义在 index.scss)
export const ProfileBox = styled(Box)(
  ({ theme, 'aria-selected': selected }) => {
    const { mode, primary, text } = theme.palette
    const isSelected = !!selected
    const isDark = mode === 'dark'

    const color = isDark ? alpha(text.secondary, 0.65) : text.secondary
    const h2color = isSelected ? primary.main : text.primary

    const baseBg = 'var(--md-sys-color-surface-container-low)'
    const hoverBg = 'var(--md-sys-color-surface-container-high)'
    const selectedBg = isDark
      ? alpha(primary.main, 0.22)
      : alpha(primary.main, 0.14)

    return {
      position: 'relative',
      display: 'block',
      cursor: 'pointer',
      textAlign: 'left',
      padding: '12px 16px',
      boxSizing: 'border-box',
      width: '100%',
      // MD3 medium 圆角 12dp
      borderRadius: '12px',
      // 跟 rex DetailPanel meta-card 同款: 整圈 1px 细边
      // selected 时整圈 border 变成 2px 主色 (不再用左色条)
      border: isSelected
        ? `2px solid ${primary.main}`
        : '1px solid var(--md-sys-color-outline-variant)',
      // 选中时减 1px padding 补偿 border 加粗带来的内容偏移
      ...(isSelected && {
        padding: '11px 15px',
      }),
      backgroundColor: isSelected ? selectedBg : baseBg,
      color,
      transition:
        'background-color 200ms cubic-bezier(0.2,0,0,1), border-color 200ms cubic-bezier(0.2,0,0,1), transform 200ms cubic-bezier(0.2,0,0,1)',
      animation: 'card-float-in 0.32s cubic-bezier(0.16, 1, 0.3, 1) both',
      '& h2': { color: h2color },
      '&:hover': {
        backgroundColor: isSelected ? selectedBg : hoverBg,
        borderColor: primary.main,
        transform: 'translateY(-1px)',
      },
    }
  },
)
