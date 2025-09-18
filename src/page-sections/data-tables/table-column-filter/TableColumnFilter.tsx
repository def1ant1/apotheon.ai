import { useMemo } from 'react'
import { Column, Table } from '@tanstack/react-table'
import { format } from 'date-fns'
// MUI
import TextField from '@mui/material/TextField'
import { DesktopDatePicker } from '@mui/x-date-pickers/DesktopDatePicker'
// MUI ICON COMPONENT
import SearchOutlined from '@mui/icons-material/SearchOutlined'
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown'
// CUSTOM STYLED COMPONENTS
import { StyledMenuItem } from './styles'

// ==============================================================
interface Props {
  column: Column<any, any>
  table: Table<any>
}
// ==============================================================

export default function TableColumnFilter({ column, table }: Props) {
  const columnFilterValue = column.getFilterValue()

  // (POSITION, ADDRESS, STATUS) COLUMN FILTER OPTION
  if (['position', 'address', 'status'].includes(column.id)) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const options = useMemo(() => {
      const set = new Set<string>()

      table.getPreFilteredRowModel().flatRows.forEach((row) => {
        set.add(row.getValue(column.id))
      })

      return Array.from(set.values())
    }, [column.id, table])

    return (
      <TextField
        select
        fullWidth
        value={columnFilterValue ?? ''}
        onChange={(e) => column.setFilterValue(e.target.value)}
        slotProps={{ select: { IconComponent: KeyboardArrowDown } }}
      >
        <StyledMenuItem value="">All</StyledMenuItem>
        {options.map((option, i) => (
          <StyledMenuItem key={i} value={option}>
            {option}
          </StyledMenuItem>
        ))}
      </TextField>
    )
  }

  // DATE OF BIRTH COLUMN FILTER OPTION
  if (column.id === 'dateOfBirth') {
    const handleChange = (date: Date | null) => {
      if (date) column.setFilterValue(format(new Date(date), 'MMM dd, yyyy'))
    }

    return (
      <DesktopDatePicker
        format="dd/MM/yy"
        onChange={handleChange}
        value={(columnFilterValue as Date) ?? null}
      />
    )
  }

  // REMAINING COLUMN FILTER OPTIONS
  return (
    <TextField
      value={columnFilterValue ?? ''}
      onChange={(e) => column.setFilterValue(e.target.value)}
      slotProps={{ input: { endAdornment: <SearchOutlined /> } }}
    />
  )
}
