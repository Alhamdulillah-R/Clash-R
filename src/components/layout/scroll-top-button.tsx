import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import { Fade, IconButton, SxProps, Theme } from '@mui/material'

interface Props {
  onClick: () => void
  show: boolean
  sx?: SxProps<Theme>
}

// 回顶按钮: 位置 = 底部 / 横向居中 (用户偏好"中间偏下")
// MD3 surface-container-high 背景 + elevation level 2
export const ScrollTopButton = ({ onClick, show, sx }: Props) => {
  return (
    <Fade in={show}>
      <IconButton
        onClick={onClick}
        size="medium"
        sx={{
          position: 'absolute',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 44,
          height: 44,
          backgroundColor: 'var(--md-sys-color-surface-container-high)',
          color: 'primary.main',
          border: '1px solid',
          borderColor: 'var(--md-sys-color-outline-variant)',
          boxShadow:
            '0 1px 2px 0 rgba(0,0,0,0.18), 0 2px 6px 2px rgba(0,0,0,0.1)',
          transition:
            'background-color 180ms cubic-bezier(0.2,0,0,1), transform 180ms cubic-bezier(0.2,0,0,1), box-shadow 180ms cubic-bezier(0.2,0,0,1)',
          '&:hover': {
            backgroundColor: 'var(--md-sys-color-surface-container-highest)',
            transform: 'translateX(-50%) translateY(-2px)',
            boxShadow:
              '0 4px 8px 3px rgba(0,0,0,0.12), 0 1px 3px 0 rgba(0,0,0,0.18)',
          },
          visibility: show ? 'visible' : 'hidden',
          zIndex: 10,
          ...sx,
        }}
      >
        <KeyboardArrowUpIcon />
      </IconButton>
    </Fade>
  )
}
