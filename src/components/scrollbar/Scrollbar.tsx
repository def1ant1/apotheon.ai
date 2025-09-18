import { PropsWithChildren } from 'react'
import { SxProps } from '@mui/material/styles'
import { Props } from 'simplebar-react'
// STYLED COMPONENT
import { StyledScrollBar } from './styles'

// ========================================================
interface ScrollbarProps extends PropsWithChildren<Props> {
  sx?: SxProps
}
// ========================================================

export default function Scrollbar({ children, sx, ...props }: ScrollbarProps) {
  return (
    <StyledScrollBar sx={sx} {...props}>
      {children}
    </StyledScrollBar>
  )
}
