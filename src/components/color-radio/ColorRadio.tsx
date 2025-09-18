import Radio, { RadioProps } from '@mui/material/Radio'
// STYLED COMPONENTS
import { InnerBox, OuterBox } from './styles'

// ==============================================================
interface Props extends RadioProps {
  icon_color?: string
}
// ==============================================================

export default function ColorRadio({ icon_color, ...props }: Props) {
  return (
    <Radio
      icon={
        <OuterBox>
          <InnerBox color={icon_color} />
        </OuterBox>
      }
      checkedIcon={
        <OuterBox color={icon_color}>
          <InnerBox color={icon_color} />
        </OuterBox>
      }
      sx={{ padding: 0 }}
      {...props}
    />
  )
}
