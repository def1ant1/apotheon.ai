import { PropsWithChildren } from 'react'
// MUI
import TableCell, { TableCellProps } from '@mui/material/TableCell'
import styled from '@mui/material/styles/styled'

// STYLED COMPONENT
const StyledTableCell = styled(TableCell)(({ theme }) => ({
  fontWeight: 500,
  padding: '.75rem 0',
  borderTop: `1px dashed ${theme.palette.divider}`,
  ':first-of-type': { paddingLeft: 24 },
}))

// ==============================================================
interface Props extends TableCellProps, PropsWithChildren {}
// ==============================================================

export default function BodyTableCell({ children, ...props }: Props) {
  return <StyledTableCell {...props}>{children}</StyledTableCell>
}
