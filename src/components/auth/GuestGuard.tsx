import { Fragment, PropsWithChildren } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
// CUSTOM DEFINED HOOK
import useAuth from '@/hooks/useAuth'

export default function GuestGuard({ children }: PropsWithChildren) {
  const { state } = useLocation()
  const { isAuthenticated } = useAuth()

  if (isAuthenticated) {
    if (state?.from) return <Navigate to={state.from} />
    // Default to the marketing homepage because private dashboards are no longer exposed.
    return <Navigate to="/" />
  }

  return <Fragment>{children || <Outlet />}</Fragment>
}
