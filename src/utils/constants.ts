import { Theme } from '@mui/material/styles/createTheme'

export const THEMES = { LIGHT: 'light', DARK: 'dark' }

export const isDark = (theme: Theme) => theme.palette.mode === 'dark'

// Centralized brand metadata keeps marketing copy, external URLs, and contact
// details aligned across the application while minimising repetitive edits.
export const BRAND = {
  name: 'Apotheon.ai',
  marketingSite: 'https://apotheon.ai',
  docs: 'https://apotheon.ai/docs',
  contact: 'https://apotheon.ai/contact',
  supportPortal: 'https://support.apotheon.ai',
  supportEmail: 'support@apotheon.ai',
}

// FOR LAYOUT 2 SECONDARY SIDEBAR
export const secondarySideBarGap = 80
export const secondarySideBarWidth = 215
