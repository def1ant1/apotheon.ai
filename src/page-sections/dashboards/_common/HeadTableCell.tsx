import { PropsWithChildren } from 'react'
// MUI
import TableCell, { TableCellProps } from '@mui/material/TableCell'
import styled from '@mui/material/styles/styled'

// STYLED COMPONENT
const StyledTableCell = styled(TableCell)({
  paddingBottom: 16,
  textTransform: 'uppercase',
  ':first-of-type': { paddingLeft: 24 },
})

// ==============================================================
interface Props extends TableCellProps, PropsWithChildren {}
// ==============================================================

export default function HeadTableCell({ children, ...props }: Props) {
  return <StyledTableCell {...props}>{children}</StyledTableCell>
}
