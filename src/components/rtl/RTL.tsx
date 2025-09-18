import { PropsWithChildren, useEffect } from 'react'
import useTheme from '@mui/material/styles/useTheme'
// EMOTION
import { CacheProvider } from '@emotion/react'
import createCache, { StylisPlugin } from '@emotion/cache'
// RTL STYLISH
import { prefixer } from 'stylis'
import stylisRTLPlugin from 'stylis-plugin-rtl'

export default function RTL({ children }: PropsWithChildren) {
  const theme = useTheme()

  useEffect(() => {
    document.dir = theme.direction
  }, [theme.direction])

  const cacheRTL = createCache({
    key: theme.direction === 'rtl' ? 'rtl' : 'css',
    stylisPlugins: theme.direction === 'rtl' ? ([prefixer, stylisRTLPlugin] as StylisPlugin[]) : [],
  })

  cacheRTL.compat = true

  return <CacheProvider value={cacheRTL}>{children}</CacheProvider>
}
