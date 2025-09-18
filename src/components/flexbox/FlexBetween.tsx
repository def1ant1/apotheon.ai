import { forwardRef } from 'react'
import Box, { BoxProps } from '@mui/material/Box'

const FlexBetween = forwardRef<HTMLDivElement, BoxProps>(({ children, ...props }, ref) => (
  <Box display="flex" alignItems="center" justifyContent="space-between" ref={ref} {...props}>
    {children}
  </Box>
))

export default FlexBetween
