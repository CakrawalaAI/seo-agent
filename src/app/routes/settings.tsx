import { createFileRoute, redirect } from '@tanstack/react-router'
import { loader } from '@pages/settings/loader'
import { Page } from '@pages/settings/page'

export const Route = createFileRoute('/settings')({
  beforeLoad: async ({ location }) => {
    try {
      const res = await fetch('/api/me', { headers: { accept: 'application/json' } })
      const data = res.ok ? await res.json() : null
      if (!data?.user) {
        throw redirect({ to: '/login', search: { redirect: location.href || '/settings' } })
      }
    } catch {
      throw redirect({ to: '/login', search: { redirect: '/settings' } })
    }
  },
  loader,
  component: Page
})
