import Box, { BoxProps } from '@mui/material/Box'
// STYLED COMPONENT
import { Shape, Text } from './styles'

// ==============================================================
interface Props extends BoxProps {
  title: string
  fontSize?: number
  centered?: boolean
}
// ==============================================================

export default function SectionTitle({ title, fontSize = 36, centered = false, ...props }: Props) {
  return (
    <Box mb={4} {...props}>
      <Text centered={centered} fontSize={fontSize}>
        {title}
      </Text>
      <Shape centered={centered} />
    </Box>
  )
}
