import { createFileRoute, redirect } from '@tanstack/react-router'
import { loader } from '@pages/projects/$projectId/loader'
import { Page } from '@pages/projects/$projectId/page'

export const Route = createFileRoute('/projects/$projectId/')({
  beforeLoad: async ({ location }) => {
    try {
      const res = await fetch('/api/me', { headers: { accept: 'application/json' } })
      const data = res.ok ? await res.json() : null
      if (!data?.user) throw redirect({ to: '/login', search: { redirect: location.href } })
    } catch {
      throw redirect({ to: '/login', search: { redirect: '/projects' } })
    }
  },
  loader,
  component: ProjectDetailRoute
})

function ProjectDetailRoute() {
  const { projectId } = Route.useParams()
  const search = Route.useSearch() as { tab?: string }
  const tab = typeof search?.tab === 'string' ? search.tab : undefined
  return <Page projectId={projectId} tab={tab} />
}
