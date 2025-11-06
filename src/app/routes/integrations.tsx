import { createFileRoute, redirect, Outlet } from '@tanstack/react-router'
import { fetchSession } from '@entities/org/service'

export const Route = createFileRoute('/integrations')({
  beforeLoad: async () => {
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

// mock-data bypass removed
