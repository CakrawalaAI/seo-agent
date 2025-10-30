import { createFileRoute, redirect } from '@tanstack/react-router'
import { loader } from '@pages/dashboard/loader'
import { Page } from '@pages/dashboard/page'
import { getCurrentUserFn } from '@server/auth'

export const Route = createFileRoute('/dashboard')({
  beforeLoad: async ({ location }) => {
    const user = await getCurrentUserFn()
    if (!user) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
  },
  loader,
  component: Page,
})
