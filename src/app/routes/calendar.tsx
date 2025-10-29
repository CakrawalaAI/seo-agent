import { createFileRoute, redirect } from '@tanstack/react-router'
import { loader } from '@pages/calendar/loader'
import { Page } from '@pages/calendar/page'

export const Route = createFileRoute('/calendar')({
  beforeLoad: async ({ location }) => {
    try {
      const res = await fetch('/api/me', { headers: { accept: 'application/json' } })
      const data = res.ok ? await res.json() : null
      if (!data?.user) {
        throw redirect({ to: '/login', search: { redirect: location.href || '/calendar' } })
      }
    } catch {
      throw redirect({ to: '/login', search: { redirect: '/calendar' } })
    }
  },
  loader,
  component: Page
})
