import { SvgIconComponent } from '@mui/icons-material'
// CUSTOM COMPONENTS
import FlexBox from '@/components/flexbox/FlexBox'
import { Paragraph } from '@/components/typography'

// ==============================================================
interface Props {
  title: string
  Icon: SvgIconComponent
}
// ==============================================================

export default function InfoItem({ title, Icon }: Props) {
  return (
    <FlexBox alignItems="center" gap={1} color="grey.500">
      <Icon sx={{ fontSize: 18 }} />
      <Paragraph>{title}</Paragraph>
    </FlexBox>
  )
}
