import { ChangeEvent, MouseEvent, useState } from 'react'

type Order = 'asc' | 'desc'

function descendingComparator<T>(a: T, b: T, orderBy: keyof T) {
  if (b[orderBy] < a[orderBy]) return -1
  if (b[orderBy] > a[orderBy]) return 1
  return 0
}

export function getComparator<Key extends keyof any>(
  order: Order,
  orderBy: Key
): (a: { [key in Key]: number | string }, b: { [key in Key]: number | string }) => number {
  return order === 'desc'
    ? (a, b) => descendingComparator(a, b, orderBy)
    : (a, b) => -descendingComparator(a, b, orderBy)
}

// Since 2020 all major browsers ensure sort stability with Array.prototype.sort().
// stableSort() brings sort stability to non-modern browsers (notably IE11). If you
// only support modern browsers you can replace stableSort(exampleArray, exampleComparator)
// with exampleArray.slice().sort(exampleComparator)
export function stableSort<T>(array: readonly T[], comparator: (a: any, b: any) => number) {
  const stabilizedThis = array.map((el, index) => [el, index] as [T, number])

  stabilizedThis.sort((a, b) => {
    const order = comparator(a[0], b[0])
    if (order !== 0) return order
    return a[1] - b[1]
  })

  return stabilizedThis.map((el) => el[0])
}

// ==============================================================
interface MuiTableProps {
  defaultOrder?: Order
  defaultPage?: number
  defaultOrderBy?: string
  defaultSelected?: string[]
  defaultRowsPerPage?: number
}
// ==============================================================

export default function useMuiTable(props: MuiTableProps) {
  const [order, setOrder] = useState<Order>(props.defaultOrder || 'asc')
  const [orderBy, setOrderBy] = useState(props.defaultOrderBy || 'name')
  const [selected, setSelected] = useState<readonly string[]>(props.defaultSelected || [])

  const [page, setPage] = useState(props.defaultPage || 0)
  const [rowsPerPage, setRowsPerPage] = useState(props.defaultRowsPerPage || 5)

  const handleRequestSort = (_: MouseEvent<unknown>, property: string) => {
    const isAsc = orderBy === property && order === 'asc'
    setOrder(isAsc ? 'desc' : 'asc')
    setOrderBy(property)
  }

  const handleSelectAllRows =
    (newSelected: string[]) => (event?: ChangeEvent<HTMLInputElement>) => {
      if (event?.target.checked) {
        setSelected(newSelected)
        return
      }

      setSelected([])
    }

  const handleSelectRow = (_: MouseEvent, name: string) => {
    const selectedIndex = selected.indexOf(name)
    let newSelected: readonly string[] = []

    if (selectedIndex === -1) {
      newSelected = newSelected.concat(selected, name)
    } else if (selectedIndex === 0) {
      newSelected = newSelected.concat(selected.slice(1))
    } else if (selectedIndex === selected.length - 1) {
      newSelected = newSelected.concat(selected.slice(0, -1))
    } else if (selectedIndex > 0) {
      newSelected = newSelected.concat(
        selected.slice(0, selectedIndex),
        selected.slice(selectedIndex + 1)
      )
    }

    setSelected(newSelected)
  }

  const handleChangePage = (_: unknown, newPage: number) => setPage(newPage)

  const handleChangeRowsPerPage = (event: ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(0)
  }

  const isSelected = (id: string) => selected.indexOf(id) !== -1

  const emptyRows = (page: number, rowsPerPage: number, dataLength: number) =>
    page > 0 ? Math.max(0, (1 + page) * rowsPerPage - dataLength) : 0

  return {
    page,
    order,
    setPage,
    orderBy,
    rowsPerPage,

    selected,
    isSelected,
    setSelected,

    emptyRows,
    handleSelectRow,
    handleChangePage,
    handleRequestSort,
    handleSelectAllRows,
    handleChangeRowsPerPage,
  }
}
