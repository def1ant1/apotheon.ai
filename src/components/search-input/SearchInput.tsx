import { forwardRef } from 'react'
import { InputBaseProps } from '@mui/material/InputBase'
// CUSTOM ICON COMPONENT
import SearchIcon from '@/icons/SearchIcon'
// STYLED COMPONENT
import { StyledInputBase } from './styles'

// ========================================================================
interface SearchInputProps extends InputBaseProps {
  bordered?: boolean
}
// ========================================================================

export default forwardRef<HTMLInputElement, SearchInputProps>(
  ({ bordered = true, ...props }, ref) => {
    // SEARCH ICON
    const ADORNMENT = <SearchIcon sx={{ mr: 1, fontSize: 18, color: 'text.secondary' }} />

    return (
      <StyledInputBase ref={ref} border={bordered ? 1 : 0} startAdornment={ADORNMENT} {...props} />
    )
  }
)
