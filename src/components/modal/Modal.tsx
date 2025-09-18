import { BoxProps } from '@mui/material/Box'
import MuiModal from '@mui/material/Modal'
// STYLED COMPONENT
import { StyledScrollbar, Wrapper } from './styles'

// ===========================================================================
interface ModalProps extends BoxProps {
  open: boolean
  handleClose: () => void
}
// ===========================================================================

export default function Modal({ children, open, handleClose, ...props }: ModalProps) {
  return (
    <MuiModal open={open} onClose={handleClose}>
      <Wrapper {...props}>
        <StyledScrollbar>{children}</StyledScrollbar>
      </Wrapper>
    </MuiModal>
  )
}
