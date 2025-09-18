import { SvgIconComponent } from '@mui/icons-material'
// CUSTOM COMPONENTS
import FlexBox from '@/components/flexbox/FlexBox'
import IconWrapper from '@/components/icon-wrapper'
import { Paragraph } from '@/components/typography'

// ==============================================================
interface Props {
  title: string
  description: string
  Icon: SvgIconComponent
}
// ==============================================================

export default function Item({ Icon, title, description }: Props) {
  return (
    <FlexBox gap={1} alignItems="center">
      <IconWrapper>
        <Icon color="primary" />
      </IconWrapper>

      <div>
        <Paragraph fontSize={16} fontWeight={500}>
          {title}
        </Paragraph>

        <Paragraph color="text.secondary">{description}</Paragraph>
      </div>
    </FlexBox>
  )
}
