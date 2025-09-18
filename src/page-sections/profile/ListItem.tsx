import { SvgIconComponent } from '@mui/icons-material'
// CUSTOM COMPONENT
import FlexBox from '@/components/flexbox/FlexBox'
import { Paragraph } from '@/components/typography'

// ============================================================================================
interface ListItemProps {
  title: string
  Icon: SvgIconComponent
}
// ============================================================================================

export default function ListItem({ title, Icon }: ListItemProps) {
  return (
    <FlexBox gap={1} alignItems="center">
      <Icon sx={{ fontSize: 14, color: 'text.secondary' }} />
      <Paragraph color="text.secondary">{title}</Paragraph>
    </FlexBox>
  )
}
