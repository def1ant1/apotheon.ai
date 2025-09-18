import { useState, ReactNode } from 'react'
// MUI
import Menu from '@mui/material/Menu'
import Fade from '@mui/material/Fade'
import MenuItem from '@mui/material/MenuItem'
import { IconButtonProps } from '@mui/material/IconButton'
// MUI ICON COMPONENT
import MoreVert from '@mui/icons-material/MoreVert'
import { SvgIconComponent } from '@mui/icons-material'
// STYLED COMPONENT
import { StyledIconButton } from './styles'

const optionList = ['Create', 'Edit', 'Delete']

// ==============================================================
interface MoreButtonProps extends IconButtonProps {
  options?: string[]
  Icon?: SvgIconComponent
  renderOptions?: (func: () => void) => ReactNode
}
// ==============================================================

export default function MoreButton({
  size = 'large',
  Icon = MoreVert,
  options = optionList,
  renderOptions,
  ...props
}: MoreButtonProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

  const handleClose = () => setAnchorEl(null)

  return (
    <div>
      <StyledIconButton
        size={size}
        aria-label="more"
        aria-haspopup="true"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        {...props}
      >
        <Icon fontSize="small" />
      </StyledIconButton>

      <Menu
        anchorEl={anchorEl}
        onClose={handleClose}
        open={Boolean(anchorEl)}
        TransitionComponent={Fade}
      >
        {renderOptions
          ? renderOptions(handleClose)
          : options.map((option) => (
              <MenuItem key={option} onClick={handleClose}>
                {option}
              </MenuItem>
            ))}
      </Menu>
    </div>
  )
}
