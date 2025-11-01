/// <reference types="vite/client" />

import { useState } from 'react'
import appCss from '@app/styles/app.css?url'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { HeadContent, Scripts, Outlet, createRootRouteWithContext, useRouterState } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@src/common/ui/sonner'
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
      { rel: 'stylesheet', href: appCss },
      {
        rel: 'icon',
        href:
          'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 128 128%22%3E%3Crect width=%22128%22 height=%22128%22 rx=%2224%22 fill=%22%23111%22/%3E%3Ctext x=%2264%22 y=%2274%22 font-size=%2272%22 text-anchor=%22middle%22 fill=%22%23fff%22 font-family=%22Arial, Helvetica, sans-serif%22%3ES%3C/text%3E%3C/svg%3E'
      }
    ]
  }),
  component: RootComponent,
  notFoundComponent: NotFound,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl px-6 py-24">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-sm text-destructive">{(error as Error)?.message || String(error)}</p>
      <a href="/" className="mt-6 inline-block text-sm font-medium underline">
        Go home
      </a>
    </div>
  )
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
        <Toaster />
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
