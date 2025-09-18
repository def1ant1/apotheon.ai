import styled from '@mui/material/styles/styled'

// ==============================================================
type StyledType = { color?: string }
// ==============================================================

// STYLED COMPONENTS
export const OuterBox = styled('div', {
  shouldForwardProp: (prop) => prop !== 'color',
})<StyledType>(({ color }) => ({
  width: 25,
  height: 25,
  padding: '1px',
  borderRadius: '50%',
  border: `1.8px solid ${color || 'transparent'}`,
}))

export const InnerBox = styled('div', {
  shouldForwardProp: (prop) => prop !== 'color',
})<StyledType>(({ color, theme }) => ({
  width: '100%',
  height: '100%',
  borderRadius: '50%',
  backgroundColor: color || theme.palette.primary.main,
}))
