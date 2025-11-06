import { createFileRoute, redirect, Outlet } from '@tanstack/react-router'
import { fetchSession } from '@entities/org/service'

export const Route = createFileRoute('/integrations')({
  beforeLoad: async ({ location }) => {
    if (shouldBypassAuth()) return
    try {
      const data = await fetchSession()
      if (!data?.user) {
        throw redirect({ to: '/' })
      }
    } catch {
      throw redirect({ to: '/' })
    }
  },
  component: IntegrationsRouteComponent
})

function IntegrationsRouteComponent() {
  return <Outlet />
}

function shouldBypassAuth(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem('seo-agent:mock-data') === 'on'
  } catch {
    return false
  }
}
