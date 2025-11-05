import { createFileRoute, redirect } from '@tanstack/react-router'
import { loader } from '@pages/settings/loader'
import { Page } from '@pages/settings/page'
import { fetchSession } from '@entities/org/service'

export const Route = createFileRoute('/settings')({
  beforeLoad: async ({ location }) => {
    try {
      const data = await fetchSession()
      if (!data?.user) throw redirect({ to: '/' })
    } catch {
      throw redirect({ to: '/' })
    }
  },
  loader,
  component: Page
})
