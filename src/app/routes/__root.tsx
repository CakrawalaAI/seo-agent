/// <reference types="vite/client" />

import { useState } from 'react'
import appCss from '@app/styles/app.css?url'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { RouterContext } from '@app/router'

function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold">Not Found</h1>
      <p className="mt-2 text-muted-foreground">The page you’re looking for doesn’t exist.</p>
      <a href="/" className="mt-6 inline-block text-sm font-medium underline">
        Go home
      </a>
    </div>
  )
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    links: [
      { rel: 'stylesheet', href: appCss }
    ]
  }),
  component: RootComponent,
  notFoundComponent: NotFound
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
