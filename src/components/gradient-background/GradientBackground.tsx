import { PropsWithChildren } from 'react'
// STYLED COMPONENT
import { StyledRoot } from './styles'

export default function GradientBackground({ children }: PropsWithChildren) {
  return <StyledRoot>{children}</StyledRoot>
}
