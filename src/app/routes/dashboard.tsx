import { createFileRoute, redirect } from '@tanstack/react-router'
import { loader } from '@pages/dashboard/loader'
import { Page } from '@pages/dashboard/page'
import { fetchSession } from '@entities/org/service'

export const Route = createFileRoute('/dashboard')({
  beforeLoad: async () => {
    try {
      const data = await fetchSession()
      if (!data?.user) throw redirect({ to: '/' })
    } catch {
      throw redirect({ to: '/' })
    }
  },
  loader,
  component: Page,
})
