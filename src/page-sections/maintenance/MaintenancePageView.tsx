import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
// CUSTOM COMPONENTS
import Link from '@/components/link'
import SectionTitle from '@/components/section-title'
import GradientBackground from '@/components/gradient-background'
// APP CONSTANTS
import { BRAND } from '@/utils/constants'
// STYLED COMPONENT
import { MainContent } from './styles'

export default function MaintenancePageView() {
  return (
    <GradientBackground>
      <Container>
        <MainContent>
          <SectionTitle centered title="Maintenance underway" />
          <p>{BRAND.name} is undergoing maintenance for future growth.</p>

          <div className="img-wrapper">
            <img src="/static/pages/maintenance.svg" alt="maintenance" width="100%" />
          </div>

          <Button LinkComponent={Link} href="/">
            Go Home
          </Button>
        </MainContent>
      </Container>
    </GradientBackground>
  )
}
