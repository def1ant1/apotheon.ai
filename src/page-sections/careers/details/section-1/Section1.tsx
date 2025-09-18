import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
// CUSTOM COMPONENT
import Link from '@/components/link/Link'
import { H6, Paragraph } from '@/components/typography'
// APP CONSTANTS
import { BRAND } from '@/utils/constants'
// STYLED COMPONENT
import { StyledRoot } from './styles'

export default function Section1() {
  return (
    <StyledRoot elevation={3}>
      <div>
        <div className="title">
          <H6 fontSize={22} lineHeight={1}>
            UI and UX Designer
          </H6>

          <Chip label="Full Time" color="primary" />
          <Chip label="Remote" color="success" />
        </div>

        <Paragraph pt={2} pb={3} lineHeight={1}>
          at {BRAND.name}
        </Paragraph>

        <div className="tags">
          <Chip label="apotheon.ai" color="secondary" />
          <Chip label="Contact" color="secondary" />
          <Chip label={`jobs@${BRAND.name.toLowerCase()}`} color="secondary" />
          <Chip label="+0123456789" color="secondary" />
          <Chip label="Facebook" color="secondary" />
          <Chip label="Whatsapp" color="secondary" />
          <Chip label="Twitter" color="secondary" />
          <Chip label="Instagram" color="secondary" />
        </div>
      </div>

      <div>
        <Button size="large" LinkComponent={Link} href="/career/apply">
          Apply this job
        </Button>
      </div>
    </StyledRoot>
  )
}
