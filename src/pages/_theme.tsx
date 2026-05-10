import getSystem from '@/utils/get-system'
const OS = getSystem()

// 字体栈：Plus Jakarta Sans 负责拉丁字符的圆润现代观感
// 中文走 Microsoft YaHei UI / PingFang SC 系统字体兜底，避免几十 MB 的 CJK 体积
// Windows 平台追加 twemoji mozilla，使部分 emoji 可彩色渲染
const DEFAULT_FONT_FAMILY = [
  '"Plus Jakarta Sans"',
  '-apple-system',
  'BlinkMacSystemFont',
  '"PingFang SC"',
  '"Microsoft YaHei UI"',
  '"Microsoft YaHei"',
  'Roboto',
  '"Helvetica Neue"',
  'Arial',
  'sans-serif',
  '"Apple Color Emoji"',
  ...(OS === 'windows' ? ['twemoji mozilla'] : []),
].join(', ')

// Material Design 3 调色 —— 严格按 baseline scheme
// https://m3.material.io/styles/color/static/baseline
// secondary 用 #625B71 (MD3 真 secondary)，比之前 #7D5260 (实际是 tertiary) 更和谐
export const defaultTheme = {
  primary_color: '#6750A4',
  secondary_color: '#625B71',
  primary_text: '#1C1B1F',
  secondary_text: '#49454F',
  info_color: '#0061A4',
  error_color: '#B3261E',
  warning_color: '#B3691A',
  success_color: '#1B6E37',
  // background 用 surface-container-low 让卡片 surface-container 能"浮"出来
  background_color: '#F7F2FA',
  font_family: DEFAULT_FONT_FAMILY,
}

// dark mode —— 对应 MD3 dark scheme baseline
export const defaultDarkTheme = {
  ...defaultTheme,
  primary_color: '#D0BCFF',
  secondary_color: '#CCC2DC',
  primary_text: '#E6E1E5',
  // dark 模式 background 用 surface-container-low (#1D1B20)
  background_color: '#1D1B20',
  secondary_text: '#CAC4D0',
  info_color: '#9ECAFF',
  error_color: '#F2B8B5',
  warning_color: '#FFB68F',
  success_color: '#7CD191',
}
