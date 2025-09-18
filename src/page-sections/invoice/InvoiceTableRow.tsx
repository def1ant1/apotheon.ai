import { MouseEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
// MUI
import Chip from '@mui/material/Chip'
import Avatar from '@mui/material/Avatar'
import Checkbox from '@mui/material/Checkbox'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
// MUI ICON COMPONENTS
import DeleteOutline from '@mui/icons-material/DeleteOutline'
import RemoveRedEye from '@mui/icons-material/RemoveRedEye'
// CUSTOM COMPONENTS
import FlexBox from '@/components/flexbox/FlexBox'
import { Paragraph } from '@/components/typography'
import { TableMoreMenuItem, TableMoreMenu } from '@/components/table'

// ==============================================================
type Invoice = {
  id: string
  date: Date
  name: string
  email: string
  status: string
  avatar: string
  invoiceId: string
}

interface InvoiceTableRowProps {
  invoice: Invoice
  isSelected: boolean
  handleDeleteInvoice: (id: string) => void
  handleSelectRow: (_: MouseEvent, name: string) => void
}
// ==============================================================

export default function InvoiceTableRow(props: InvoiceTableRowProps) {
  const { invoice, isSelected, handleDeleteInvoice, handleSelectRow } = props

  const navigate = useNavigate()
  const [openMenuEl, setOpenMenuEl] = useState<null | HTMLElement>(null)

  const handleOpenMenu = (event: MouseEvent<HTMLButtonElement>) => {
    setOpenMenuEl(event.currentTarget)
  }

  const handleCloseOpenMenu = () => setOpenMenuEl(null)

  return (
    <TableRow hover>
      <TableCell padding="checkbox">
        <Checkbox
          size="small"
          color="primary"
          checked={isSelected}
          onClick={(event) => handleSelectRow(event, invoice.id)}
        />
      </TableCell>

      <TableCell padding="normal">
        <FlexBox alignItems="center" gap={2}>
          <Avatar src={invoice.avatar} alt={invoice.name} variant="rounded" />

          <div>
            <Paragraph
              fontWeight={500}
              color="text.primary"
              sx={{ ':hover': { textDecoration: 'underline', cursor: 'pointer' } }}
            >
              {invoice.name}
            </Paragraph>

            <Paragraph fontSize={13}>{invoice.id.substring(0, 15)}</Paragraph>
          </div>
        </FlexBox>
      </TableCell>

      <TableCell padding="normal">{invoice.email}</TableCell>

      <TableCell padding="normal">
        <Paragraph color="text.secondary">{format(invoice.date, 'MMM dd, yyyy')}</Paragraph>
      </TableCell>

      <TableCell padding="normal">
        <Chip
          size="small"
          label={invoice.status}
          color={invoice.status === 'Complete' ? 'success' : 'error'}
        />
      </TableCell>

      <TableCell padding="normal">
        <TableMoreMenu
          open={openMenuEl}
          handleOpen={handleOpenMenu}
          handleClose={handleCloseOpenMenu}
        >
          <TableMoreMenuItem
            title="View"
            Icon={RemoveRedEye}
            handleClick={() => {
              handleCloseOpenMenu()
              navigate('/dashboard/invoice-details')
            }}
          />
          <TableMoreMenuItem
            title="Delete"
            Icon={DeleteOutline}
            handleClick={() => {
              handleCloseOpenMenu()
              handleDeleteInvoice(invoice.id)
            }}
          />
        </TableMoreMenu>
      </TableCell>
    </TableRow>
  )
}
