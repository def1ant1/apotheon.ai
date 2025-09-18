import { forwardRef } from 'react'
import { BoxProps } from '@mui/material/Box'
// STYLED COMPONENT
import { Wrapper } from './styles'

export default forwardRef<HTMLDivElement, BoxProps>(({ children, ...props }, ref) => (
  <Wrapper ref={ref} {...props}>
    {children}
  </Wrapper>
))
