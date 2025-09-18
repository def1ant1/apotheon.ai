import { PropsWithChildren } from 'react'
// STYLED COMPONENT
import { Status } from './styles'

export type Type = 'success' | 'primary' | 'error' | 'warning'

// ==============================================================
interface Props extends PropsWithChildren {
  type: string
}
// ==============================================================

export default function StatusBadge({ children, type, ...props }: Props) {
  return (
    <Status type={type as Type} {...props}>
      {children}
    </Status>
  )
}
