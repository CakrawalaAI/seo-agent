import { createFileRoute, redirect } from '@tanstack/react-router'
import { Page } from '@pages/integrations/$integrationId/page'

export const Route = createFileRoute('/integrations/$integrationId')({
  beforeLoad: async ({ location, params }) => {
    if (params.integrationId === 'webhook') {
      const searchObject = Object.fromEntries(new URL(location.href).searchParams.entries())
      throw redirect({
        to: '/integrations/webhook',
        search: () => searchObject as never
      })
    }
    if (shouldBypassAuth()) return
  },
  component: () => {
    const { integrationId } = Route.useParams()
    return <Page integrationId={integrationId} />
  }
})

function shouldBypassAuth(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem('seo-agent:mock-data') === 'on'
  } catch {
    return false
  }
}
