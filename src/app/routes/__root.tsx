/// <reference types="vite/client" />

import { useState } from 'react'
import appCss from '@app/styles/app.css?url'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { HeadContent, Scripts, Outlet, createRootRouteWithContext, useRouterState } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { RouterContext } from '@app/router'
import { DashboardLayout } from '@blocks/layouts/dashboard-layout'

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
    <RootDocument>
      <QueryClientProvider client={queryClient}>
        <RouteWrapper>
          <Outlet />
        </RouteWrapper>
        <TanStackRouterDevtools position="bottom-right" />
      </QueryClientProvider>
    </RootDocument>
  )
}

function RootDocument({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}

function RouteWrapper({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const isPublic = pathname === '/' || pathname.startsWith('/login')
  if (isPublic) {
    return <div className="min-h-screen bg-background text-foreground">{children}</div>
  }
  return (
    <div className="min-h-screen bg-background text-foreground">
      <DashboardLayout>{children}</DashboardLayout>
    </div>
  )
}
