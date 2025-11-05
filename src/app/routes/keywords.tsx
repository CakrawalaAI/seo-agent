import { createFileRoute, redirect } from '@tanstack/react-router'
import { loader } from '@pages/keywords/loader'
import { Page } from '@pages/keywords/page'
import { fetchSession } from '@entities/org/service'

export const Route = createFileRoute('/keywords')({
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
