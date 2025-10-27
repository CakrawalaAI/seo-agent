import { createFileRoute } from '@tanstack/react-router'
import { loader } from '@pages/projects/$projectId/loader'
import { Page } from '@pages/projects/$projectId/page'

export const Route = createFileRoute('/projects/$projectId/')({
  loader,
  component: ProjectDetailRoute
})

function ProjectDetailRoute() {
  const { projectId } = Route.useParams()
  const search = Route.useSearch() as { tab?: string }
  const tab = typeof search?.tab === 'string' ? search.tab : undefined
  return <Page projectId={projectId} tab={tab} />
}
