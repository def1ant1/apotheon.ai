import { FC, LazyExoticComponent, Suspense } from 'react'
import { LoadingProgress } from '@/components/loader'

const Loadable = (Component: LazyExoticComponent<FC>) => (props: any) => {
  return (
    <Suspense fallback={<LoadingProgress />}>
      <Component {...props} />
    </Suspense>
  )
}

export default Loadable
