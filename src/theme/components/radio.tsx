import { Components } from '@mui/material/styles/components'
// CUSTOM ICON COMPONENTS
import RadioButtonIcon from '@/icons/RadioButtonIcon'
import RadioButtonChecked from '@/icons/RadioButtonChecked'

// ==============================================================
declare module '@mui/material/Radio' {
  interface RadioPropsSizeOverrides {
    large: true
  }
}
// ==============================================================

const Radio = (): Components['MuiRadio'] => ({
  defaultProps: {
    icon: <RadioButtonIcon />,
    checkedIcon: <RadioButtonChecked />,
  },
  styleOverrides: {
    root: { padding: 6 },
  },
  variants: [
    {
      props: { size: 'large' },
      style: { '.MuiSvgIcon-root': { fontSize: '1.75rem' } },
    },
  ],
})

export default Radio
