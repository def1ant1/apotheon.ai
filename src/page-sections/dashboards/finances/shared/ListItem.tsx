import useTheme from '@mui/material/styles/useTheme'
import { SxProps } from '@mui/system/styleFunctionSx'
// CUSTOM COMPONENTS
import { Paragraph } from '@/components/typography'
import { FlexBox, FlexRowAlign } from '@/components/flexbox'
// CUSTOM UTILS METHOD
import { isDark } from '@/utils/constants'

// =========================================================================
interface Props {
  title: string
  Icon: JSX.Element
  subTitle?: string
  iconStyle?: SxProps
  titleStyle?: SxProps
}
// =========================================================================

export default function ListItem({
  Icon,
  title,
  subTitle,
  iconStyle = {},
  titleStyle = {},
}: Props) {
  const theme = useTheme()

  const BG_COLOR = isDark(theme) ? 'grey.700' : 'grey.50'

  return (
    <FlexBox alignItems="center" gap={1.5}>
      <FlexRowAlign width={40} height={40} borderRadius={2} bgcolor={BG_COLOR} sx={iconStyle}>
        {Icon}
      </FlexRowAlign>

      <div>
        <Paragraph lineHeight={1} fontSize={16} fontWeight={600} sx={titleStyle}>
          {title}
        </Paragraph>

        {subTitle && <Paragraph color="text.secondary">{subTitle}</Paragraph>}
      </div>
    </FlexBox>
  )
}
