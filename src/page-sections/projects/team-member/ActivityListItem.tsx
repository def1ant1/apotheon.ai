import { SvgIconComponent } from '@mui/icons-material'
import styled from '@mui/material/styles/styled'
// CUSTOM COMPONENT
import { Paragraph } from '@/components/typography'

// STYLED COMPONENT
const StyledRoot = styled('div')(({ theme }) => ({
  gap: '1rem',
  display: 'flex',
  marginBottom: '1rem',
  '&:last-child': { marginBottom: 0 },
  '& .icon-wrapper': {
    width: 30,
    height: 30,
    display: 'flex',
    marginTop: '5px',
    borderRadius: '50%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.palette.action.hover,
  },
}))

// ==============================================================
interface Props {
  date: string
  title: string
  Icon: SvgIconComponent
}
// ==============================================================

export default function ActivityListItem({ title, Icon, date }: Props) {
  return (
    <StyledRoot>
      <div>
        <div className="icon-wrapper">
          <Icon sx={{ color: 'text.secondary', fontSize: 16 }} />
        </div>
      </div>

      <div>
        <Paragraph fontWeight={500}>{title}</Paragraph>
        <Paragraph fontSize={12} color="text.secondary">
          {date}
        </Paragraph>
      </div>
    </StyledRoot>
  )
}
