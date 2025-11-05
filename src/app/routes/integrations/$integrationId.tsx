import { createFileRoute, redirect } from '@tanstack/react-router'
import { ensureIntegrationAccess } from '@app/integrations/ensure-auth'
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

    try {
      await ensureIntegrationAccess(location.href)
    } catch {
      throw redirect({ to: '/' })
    }
  },
  component: () => {
    const { integrationId } = Route.useParams()
    return <Page integrationId={integrationId} />
  }
})
