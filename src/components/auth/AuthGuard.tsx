import { PropsWithChildren } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
// CUSTOM DEFINED HOOK
import useAuth from '@/hooks/useAuth'

export default function AuthGuard({ children }: PropsWithChildren) {
  const { pathname } = useLocation()
  const { isAuthenticated } = useAuth()

  if (isAuthenticated) return <>{children}</>

  return <Navigate replace to="/login" state={{ from: pathname }} />
}
