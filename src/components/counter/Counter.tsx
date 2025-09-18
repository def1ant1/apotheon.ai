import { useState } from 'react'
// MUI
import IconButton from '@mui/material/IconButton'
// MUI ICON COMPONENTS
import Add from '@mui/icons-material/Add'
import Remove from '@mui/icons-material/Remove'
// STYLED COMPONENT
import { StyledInputBase } from './styles'

// ==============================================================
export interface CounterProps {
  colors?: 'light' | 'dark'
  button?: 'plain' | 'outlined'
  variant?: 'rounded' | 'circular'
}
// ==============================================================

export default function Counter({
  colors = 'light',
  button = 'plain',
  variant = 'rounded',
}: CounterProps) {
  const [value, setValue] = useState(0)

  // QUANTITY INCREMENT BUTTON
  const StartAdornment = (
    <IconButton onClick={() => setValue((state) => state + 1)}>
      <Add fontSize="small" />
    </IconButton>
  )

  // QUANTITY DECREMENT BUTTON
  const EndAdornment = (
    <IconButton onClick={() => setValue((state) => state - 1)}>
      <Remove fontSize="small" />
    </IconButton>
  )

  return (
    <StyledInputBase
      value={value}
      colors={colors}
      button={button}
      variant={variant}
      endAdornment={EndAdornment}
      startAdornment={StartAdornment}
    />
  )
}
