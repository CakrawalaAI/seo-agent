import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { fetchSession } from '@entities/org/service'

function ArticlesLayout() {
  return <Outlet />
}

export const Route = createFileRoute('/articles')({
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
  component: ArticlesLayout
})
