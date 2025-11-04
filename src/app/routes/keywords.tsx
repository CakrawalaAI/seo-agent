import { createFileRoute, redirect } from '@tanstack/react-router'
import { loader } from '@pages/keywords/loader'
import { Page } from '@pages/keywords/page'

export const Route = createFileRoute('/keywords')({
  beforeLoad: async ({ location }) => {
    try {
      const res = await fetch('/api/me', { headers: { accept: 'application/json' } })
      const data = res.ok ? await res.json() : null
      if (!data?.user) {
        throw redirect({ to: '/' })
      }
    } catch {
      throw redirect({ to: '/' })
    }
  },
  loader,
  component: Page
})
