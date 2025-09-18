import Checkbox, { CheckboxProps } from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'

// ==============================================================
interface Props extends CheckboxProps {
  label: string
}
// ==============================================================

export default function CheckboxLabel({ label, ...props }: Props) {
  return (
    <FormControlLabel
      label={label}
      control={<Checkbox size="small" {...props} />}
      slotProps={{ typography: { fontSize: 14 } }}
    />
  )
}
