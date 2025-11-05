import { createFileRoute, redirect } from '@tanstack/react-router'
import { Page } from '@pages/integrations/webhook/page'
import { ensureIntegrationAccess } from '@app/integrations/ensure-auth'

export const Route = createFileRoute('/integrations/webhook')({
  beforeLoad: async ({ location }) => {
    try {
      await ensureIntegrationAccess(location.href)
    } catch {
      throw redirect({ to: '/' })
    }
  },
  component: Page
})
