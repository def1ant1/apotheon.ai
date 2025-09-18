import { ComponentPropsWithRef, PropsWithChildren } from 'react'
// STYLED COMPONENT
import { StyledFancyText } from './style'

// ==============================================================
interface Props extends PropsWithChildren, ComponentPropsWithRef<'span'> {}
// ==============================================================

export default function FancyText({ children, ...props }: Props) {
  return <StyledFancyText {...props}>{children}</StyledFancyText>
}
