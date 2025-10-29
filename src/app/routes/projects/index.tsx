import { createFileRoute, redirect } from '@tanstack/react-router'
import { loader } from '@pages/projects/index/loader'
import { Page } from '@pages/projects/index/page'

export const Route = createFileRoute('/projects/')({
  beforeLoad: async ({ location }) => {
    try {
      const res = await fetch('/api/me', { headers: { accept: 'application/json' } })
      const data = res.ok ? await res.json() : null
      if (!data?.user) throw redirect({ to: '/login', search: { redirect: location.href || '/projects' } })
    } catch {
      throw redirect({ to: '/login', search: { redirect: '/projects' } })
    }
  },
  loader,
  component: Page
})
