import { Paragraph } from '@/components/typography'
import FlexBetween from '@/components/flexbox/FlexBetween'

// ==============================================================
interface ListItemProps {
  title: string
  value: number
  valueColor?: string
}
// ==============================================================

export default function ListItem({ title, value, valueColor }: ListItemProps) {
  return (
    <FlexBetween>
      <Paragraph>{title}</Paragraph>
      <Paragraph color={valueColor}>${value}</Paragraph>
    </FlexBetween>
  )
}
