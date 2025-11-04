import { createFileRoute, redirect } from '@tanstack/react-router'
import { Page } from '@pages/integrations/page'

export const Route = createFileRoute('/integrations')({
  beforeLoad: async ({ location }) => {
    try {
      const res = await fetch('/api/me', {
        headers: { accept: 'application/json' },
        credentials: 'include'
      })
      const data = res.ok ? await res.json() : null
      if (!data?.user) {
        throw redirect({ to: '/' })
      }
    } catch {
      throw redirect({ to: '/' })
    }
  },
  component: Page
})
