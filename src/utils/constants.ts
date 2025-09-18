import { Theme } from '@mui/material/styles/createTheme'

export const THEMES = { LIGHT: 'light', DARK: 'dark' }

export const isDark = (theme: Theme) => theme.palette.mode === 'dark'

// FOR LAYOUT 2 SECONDARY SIDEBAR
export const secondarySideBarGap = 80
export const secondarySideBarWidth = 215
