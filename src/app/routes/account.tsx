import { createFileRoute, redirect } from '@tanstack/react-router'
import { loader } from '@pages/account/loader'
import { Page } from '@pages/account/page'

export const Route = createFileRoute('/account')({
  beforeLoad: async ({ location }) => {
    try {
      const res = await fetch('/api/me', { headers: { accept: 'application/json' } })
      const data = res.ok ? await res.json() : null
      if (!data?.user) {
        throw redirect({ to: '/login', search: { redirect: location.href || '/account' } })
      }
    } catch {
      throw redirect({ to: '/login', search: { redirect: '/account' } })
    }
  },
  loader,
  component: Page
})
