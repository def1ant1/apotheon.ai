import { PropsWithChildren, ReactNode } from 'react'
// MUI
import TimelineDot from '@mui/lab/TimelineDot'
import TimelineItem from '@mui/lab/TimelineItem'
import TimelineContent from '@mui/lab/TimelineContent'
import TimelineSeparator from '@mui/lab/TimelineSeparator'
import TimelineConnector from '@mui/lab/TimelineConnector'

// ==============================================================
interface Props extends PropsWithChildren {
  Icon: ReactNode
}
// ==============================================================

export default function ItemLayout({ Icon, children }: Props) {
  return (
    <TimelineItem sx={{ '&::before': { display: 'none' } }}>
      <TimelineSeparator>
        <TimelineDot>{Icon}</TimelineDot>
        <TimelineConnector />
      </TimelineSeparator>

      <TimelineContent pb={3}>{children}</TimelineContent>
    </TimelineItem>
  )
}
