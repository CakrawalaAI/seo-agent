import { createFileRoute, redirect } from '@tanstack/react-router'
import { loader } from '@pages/settings/loader'
import { Page } from '@pages/settings/page'

export const Route = createFileRoute('/settings')({
  beforeLoad: async ({ location }) => {
    try {
      const res = await fetch('/api/me', { headers: { accept: 'application/json' } })
      const data = res.ok ? await res.json() : null
      if (!data?.user) throw redirect({ to: '/' })
    } catch {
      throw redirect({ to: '/' })
    }
  },
  loader,
  component: Page
})
