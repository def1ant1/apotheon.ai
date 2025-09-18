import styled from '@mui/material/styles/styled'

// ==============================================================
type ShapeProps = { centered: boolean }
type TextProps = ShapeProps & { fontSize: number }
// ==============================================================

export const Text = styled('h1', {
  shouldForwardProp: (prop) => prop !== 'centered' && prop !== 'fontSize',
})<TextProps>(({ theme, centered, fontSize }) => ({
  fontSize,
  fontWeight: 600,
  ...(centered && { textAlign: 'center' }),

  [theme.breakpoints.down('sm')]: { fontSize: 32 },
  [theme.breakpoints.down(425)]: { fontSize: 27 },
}))

export const Shape = styled('div', {
  shouldForwardProp: (prop) => prop !== 'centered',
})<ShapeProps>(({ theme, centered }) => ({
  height: 4,
  width: 140,
  marginTop: theme.spacing(1),
  borderRadius: theme.spacing(4),
  background: 'linear-gradient(90deg, #6950E8 0%, #F600CF 120%)',
  ...(centered && { marginInline: 'auto' }),
}))
