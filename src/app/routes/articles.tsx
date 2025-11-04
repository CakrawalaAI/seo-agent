import { createFileRoute, redirect } from '@tanstack/react-router'
import { loader } from '@pages/articles/loader'
import { Page } from '@pages/articles/page'

export const Route = createFileRoute('/articles')({
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
