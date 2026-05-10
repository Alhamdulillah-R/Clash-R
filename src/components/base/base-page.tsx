import { Typography } from '@mui/material'
import React, { ReactNode } from 'react'

import { BaseErrorBoundary } from './base-error-boundary'

interface Props {
  title?: React.ReactNode // the page title
  header?: React.ReactNode // something behind title
  contentStyle?: React.CSSProperties
  children?: ReactNode
  full?: boolean
}

export const BasePage: React.FC<Props> = (props) => {
  const { title, header, contentStyle, full, children } = props

  // 不再硬编码 #1e1f27 / #ffffff，全部改成 MD3 surface-container CSS 变量
  // 这样深浅色 + 自定义主色都自动跟随
  return (
    <BaseErrorBoundary>
      <div className="base-page">
        <header data-tauri-drag-region="true" style={{ userSelect: 'none' }}>
          <Typography
            // MD3 headline-small: 24px / weight 500，比之前 20/700 更克制
            sx={{ fontSize: '24px', fontWeight: 500, letterSpacing: 0 }}
            data-tauri-drag-region="true"
          >
            {title}
          </Typography>

          {header}
        </header>

        <div
          className={full ? 'base-container no-padding' : 'base-container'}
          style={{
            backgroundColor: 'var(--md-sys-color-surface-container-low)',
          }}
        >
          <section
            style={{
              backgroundColor: 'var(--md-sys-color-surface-container-low)',
            }}
          >
            <div className="base-content" style={contentStyle}>
              {children}
            </div>
          </section>
        </div>
      </div>
    </BaseErrorBoundary>
  )
}
