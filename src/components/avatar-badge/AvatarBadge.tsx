import { forwardRef } from 'react'
import { BadgeProps } from '@mui/material/Badge'
// STYLED COMPONENT
import { StyledBadge } from './styles'

// ===================================================================
interface Props extends BadgeProps {
  width?: number
  height?: number
}
// ===================================================================

const AvatarBadge = forwardRef<HTMLSpanElement, Props>((props, ref) => {
  const { children, width = 25, height = 25, ...others } = props

  return (
    <StyledBadge
      ref={ref}
      width={width}
      height={height}
      overlap="circular"
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      {...others}
    >
      {children}
    </StyledBadge>
  )
})

export default AvatarBadge
