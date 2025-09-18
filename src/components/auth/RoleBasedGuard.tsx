import { PropsWithChildren } from 'react'
import { Outlet } from 'react-router-dom'
// MUI
import Stack from '@mui/material/Stack'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
// CUSTOM DEFINED HOOK
import useAuth from '@/hooks/useAuth'

// ==============================================================
interface Props extends PropsWithChildren {
  roles: string[]
}
// ==============================================================

export default function RoleBasedGuard({ children, roles }: Props) {
  const { user } = useAuth()

  const loggedInUserRole = user?.role

  if (loggedInUserRole && roles.includes(loggedInUserRole)) return <>{children || <Outlet />}</>

  // Minimal inline view keeps the guard usable without relying on removed private page sections.
  return (
    <Stack spacing={2} py={12} alignItems="center" textAlign="center">
      <Typography variant="h4" fontWeight={700}>
        Access restricted
      </Typography>
      <Typography maxWidth={420} color="text.secondary">
        This environment only surfaces public marketing experiences. Sign in to the secure platform to
        manage internal workflows.
      </Typography>
      <Button href="/" variant="contained" color="primary">
        Return to homepage
      </Button>
    </Stack>
  )
}
