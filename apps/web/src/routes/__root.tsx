// @ts-nocheck
import '../styles.css'

import { useState } from 'react'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'
import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { RouterContext } from '../router'

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent
})

function RootComponent(): JSX.Element {
  const [queryClient] = useState(() => new QueryClient())
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background text-foreground">
        <Outlet />
        <TanStackRouterDevtools position="bottom-right" />
      </div>
    </QueryClientProvider>
  )
}
