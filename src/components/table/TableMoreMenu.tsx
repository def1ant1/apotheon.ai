import { Fragment, MouseEvent, PropsWithChildren } from 'react'
// MUI
import Menu from '@mui/material/Menu'
import IconButton from '@mui/material/IconButton'
// MUI ICON COMPONENT
import MoreVert from '@mui/icons-material/MoreVert'

// ==============================================================
interface TableMoreMenuProps extends PropsWithChildren {
  open: HTMLElement | null
  handleClose: () => void
  handleOpen: (event: MouseEvent<HTMLButtonElement>) => void
}
// ==============================================================

export default function TableMoreMenu(props: TableMoreMenuProps) {
  const { open, children, handleClose, handleOpen } = props

  return (
    <Fragment>
      <IconButton color="secondary" onClick={handleOpen}>
        <MoreVert fontSize="small" />
      </IconButton>

      <Menu
        anchorEl={open}
        open={Boolean(open)}
        onClose={handleClose}
        transformOrigin={{ vertical: 'center', horizontal: 'right' }}
      >
        {children}
      </Menu>
    </Fragment>
  )
}
