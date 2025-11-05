import { createFileRoute, redirect } from '@tanstack/react-router'
import { loader } from '@pages/calendar/loader'
import { Page } from '@pages/calendar/page'
import { fetchSession } from '@entities/org/service'

export const Route = createFileRoute('/calendar')({
  beforeLoad: async ({ location }) => {
    try {
      const data = await fetchSession()
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
