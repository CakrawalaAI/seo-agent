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
    // mock-data bypass removed
  },
  component: () => {
    const { integrationId } = Route.useParams()
    return <Page integrationId={integrationId} />
  }
})
// mock-data bypass removed
