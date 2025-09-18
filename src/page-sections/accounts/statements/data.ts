import { SvgIconComponent } from '@mui/icons-material'
import { SvgIconProps } from '@mui/material/SvgIcon'
// CUSTOM ICON COMPONENTS
import ChartIcon from '@/icons/ChartIcon'
import ReceiptOutlined from '@/icons/ReceiptOutlined'
import ChartDonut from '@/icons/sidebar/ChartDonutIcon'

// ==============================================================
interface List {
  id: number
  name: string
  amount: number
  Icon: SvgIconComponent
  iconColor: SvgIconProps['color']
}
// ==============================================================

export const EARNING_LIST: List[] = [
  {
    id: 1,
    amount: 4550,
    Icon: ChartIcon,
    name: 'Net Earnings',
    iconColor: 'primary',
  },
  {
    id: 2,
    amount: 80,
    name: 'Change',
    Icon: ChartDonut,
    iconColor: 'warning',
  },
  {
    id: 3,
    amount: 2800,
    name: 'Fees',
    Icon: ReceiptOutlined,
    iconColor: 'info',
  },
]
