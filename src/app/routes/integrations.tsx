import { createFileRoute, redirect } from '@tanstack/react-router'
import { Page } from '@pages/integrations/page'
import { fetchSession } from '@entities/org/service'

export const Route = createFileRoute('/integrations')({
  beforeLoad: async ({ location }) => {
    try {
      const data = await fetchSession()
      if (!data?.user) {
        throw redirect({ to: '/' })
      }
    } catch {
      throw redirect({ to: '/' })
    }
  },
  component: Page
})
