import { ReactNode } from 'react'
// CUSTOM COMPONENTS
import { Paragraph } from '@/components/typography'
import FlexBetween from '@/components/flexbox/FlexBetween'

// ==============================================================
type Props = { title: string; value: string | ReactNode }
// ==============================================================

export default function ListItem({ title, value }: Props) {
  return (
    <FlexBetween>
      <Paragraph fontSize={16} fontWeight={500} color="text.secondary">
        {title}
      </Paragraph>

      {typeof value === 'string' ? (
        <Paragraph fontSize={16} fontWeight={500}>
          {value}
        </Paragraph>
      ) : (
        value
      )}
    </FlexBetween>
  )
}
