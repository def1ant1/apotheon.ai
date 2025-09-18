import { Theme } from '@mui/material/styles/createTheme'
import { Components } from '@mui/material/styles/components'
// CUSTOM UTILS METHOD
import { isDark } from '@/utils/constants'

// ==============================================================
declare module '@mui/material/Avatar' {
  interface AvatarPropsVariantOverrides {
    bordered: true
  }
}
// ==============================================================

export const Avatar = (theme: Theme): Components['MuiAvatar'] => {
  const { grey, primary } = theme.palette

  return {
    variants: [
      {
        props: { variant: 'bordered' },
        style: {
          padding: 3,
          backgroundOrigin: 'border-box',
          border: 'double 1px transparent',
          backgroundClip: 'padding-box, border-box',
          backgroundImage: `linear-gradient(white, white), conic-gradient(from 30deg, ${primary.main} 180deg, ${grey[200]} 180deg)`,
          ...(isDark(theme) && {
            backgroundImage: `linear-gradient(${grey[800]}, ${grey[800]}), conic-gradient(from 30deg, ${primary.main} 180deg, ${grey[800]} 180deg)`,
          }),
        },
      },
    ],
  }
}

export const AvatarGroup = (theme: Theme): Components['MuiAvatarGroup'] => {
  return {
    styleOverrides: {
      avatar: {
        width: 36,
        height: 36,
        padding: 0,
        fontSize: 12,
        border: '2px solid white',
        ...(isDark(theme) && {
          border: `1px solid ${theme.palette.grey[600]}`,
        }),
      },

      root: { justifyContent: 'flex-end' },
    },
  }
}
