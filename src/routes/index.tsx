import { lazy } from 'react'
import { RouteObject } from 'react-router-dom'
import Loadable from './Loadable'

import { PublicRoutes } from './public'

/**
 * NOTE: The router intentionally exposes only public-facing content.
 * Internal dashboards, authentication demos, and component showcases were
 * removed to keep the bundle aligned with a marketing website footprint.
 */

// GLOBAL ERROR PAGE
const ErrorPage = Loadable(lazy(() => import('@/pages/404')))
// LANDING / INITIAL PAGE
const Landing = Loadable(lazy(() => import('@/pages/landing')))

export const routes = (): RouteObject[] => {
  return [
    // INITIAL / INDEX PAGE
    { path: '/', element: <Landing /> },

    // GLOBAL ERROR PAGE
    { path: '*', element: <ErrorPage /> },

    // PAGES ROUTES
    ...PublicRoutes,
  ]
}
