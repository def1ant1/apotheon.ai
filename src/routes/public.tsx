import { lazy } from 'react'
import { Outlet } from 'react-router-dom'
// CUSTOM COMPONENTS
import Loadable from './Loadable'
import RootLayout from '@/layouts/root/RootLayout'

// FEATURE-ORIENTED PUBLIC PAGES
const Faqs = Loadable(lazy(() => import('@/pages/faq')))
const Pricing = Loadable(lazy(() => import('@/pages/pricing')))
const ContactUs = Loadable(lazy(() => import('@/pages/contact-us')))
const ComingSoon = Loadable(lazy(() => import('@/pages/coming-soon')))
const Maintenance = Loadable(lazy(() => import('@/pages/maintenance')))
const CareerApply = Loadable(lazy(() => import('@/pages/career/apply')))
const CareerTwo = Loadable(lazy(() => import('@/pages/career/career-2')))
const CareerDetails = Loadable(lazy(() => import('@/pages/career/details')))
const AboutUsOne = Loadable(lazy(() => import('@/pages/about-us/about-us-1')))

export const PublicRoutes = [
  { path: 'maintenance', element: <Maintenance /> },
  { path: 'coming-soon', element: <ComingSoon /> },
  {
    element: (
      <RootLayout>
        <Outlet />
      </RootLayout>
    ),
    children: [
      // The following routes represent the evergreen marketing pages that are
      // safe to expose publicly without authentication barriers.
      { path: 'about-us', element: <AboutUsOne /> },
      { path: 'contact-us', element: <ContactUs /> },
      { path: 'faqs', element: <Faqs /> },
      { path: 'pricing', element: <Pricing /> },
      {
        path: 'career',
        children: [
          { index: true, element: <CareerTwo /> },
          { path: ':slug', element: <CareerDetails /> },
          { path: 'apply', element: <CareerApply /> },
        ],
      },
    ],
  },
]
