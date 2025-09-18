import { forwardRef } from 'react'
import Box, { BoxProps } from '@mui/material/Box'

const FlexRowAlign = forwardRef<HTMLDivElement, BoxProps>(({ children, ...props }, ref) => (
  <Box display="flex" alignItems="center" justifyContent="center" ref={ref} {...props}>
    {children}
  </Box>
))

export default FlexRowAlign
