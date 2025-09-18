import { forwardRef } from 'react'
import { Link as RouterLink, LinkProps } from 'react-router-dom'

// ==============================================================
interface Props extends Omit<LinkProps, 'to'> {
  href: string
}
// ==============================================================

export default forwardRef<HTMLAnchorElement, Props>(({ href, ...others }, ref) => {
  return <RouterLink ref={ref} to={href} {...others} />
})
