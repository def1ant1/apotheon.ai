import { Theme } from '@mui/material/styles/createTheme'
import { Components } from '@mui/material/styles/components'

const Fab = (theme: Theme): Components['MuiFab'] => {
  return {
    styleOverrides: {
      extended: ({ ownerState: { color } }) => ({
        gap: 4,
        lineHeight: 1,
        textTransform: 'none',
        ...((color === 'success' || color === 'warning') && { color: 'white' }),
      }),

      circular: ({ ownerState: { color } }) => ({
        lineHeight: 1,
        ...((color === 'success' || color === 'warning') && { color: 'white' }),
      }),

      sizeSmall: ({ ownerState: { variant } }) => ({
        fontSize: 14,
        svg: { fontSize: 20 },
        ...(variant === 'extended' && { paddingInline: '1rem' }),
      }),
    },
  }
}

export default Fab
