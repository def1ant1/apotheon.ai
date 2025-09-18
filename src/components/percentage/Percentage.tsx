import { PropsWithChildren } from 'react'
import { BoxProps } from '@mui/material/Box'
// STYLED COMPONENT
import { StyledSpan } from './styles'

export type Type = 'primary' | 'success' | 'error'

// ==============================================================
interface Props extends PropsWithChildren, BoxProps {
  type?: Type
  ellipsis?: boolean
}
// ==============================================================

export default function Percentage({
  children,
  type = 'success',
  ellipsis = false,
  ...props
}: Props) {
  return (
    <StyledSpan ellipsis={ellipsis} type={type} {...props}>
      {children}
    </StyledSpan>
  )
}
