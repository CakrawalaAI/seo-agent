import { createFileRoute, redirect } from '@tanstack/react-router'
import { loader } from '@pages/dashboard/loader'
import { Page } from '@pages/dashboard/page'

export const Route = createFileRoute('/dashboard')({
  beforeLoad: async ({ location }) => {
    try {
      const res = await fetch('/api/me', { headers: { 'accept': 'application/json' } })
      const data = res.ok ? await res.json() : null
      if (!data?.user) {
        throw redirect({ to: '/login', search: { redirect: '/dashboard' } })
      }
    } catch {
      throw redirect({ to: '/login', search: { redirect: '/dashboard' } })
    }
  },
  loader,
  component: Page
})
