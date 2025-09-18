import { SvgIconComponent } from '@mui/icons-material'
// CUSTOM COMPONENTS
import { H6, Small } from '@/components/typography'
// UTILS METHOD
import { currency } from '@/utils/currency'
// STYLED COMPONENT
import { StyledStack } from './styles'

// =====================================================================
interface AmountCardProps {
  title: string
  amount: number
  Icon: SvgIconComponent
}
// =====================================================================

export default function AmountCard({ Icon, amount, title }: AmountCardProps) {
  return (
    <StyledStack>
      <Icon className="icon" />

      <H6 fontSize={14} mt={0.5}>
        {currency(amount)}
      </H6>

      <Small ellipsis color="grey.500">
        {title}
      </Small>
    </StyledStack>
  )
}
