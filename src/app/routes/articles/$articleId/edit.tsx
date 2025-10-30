import { createFileRoute } from '@tanstack/react-router'
import { Page } from '@pages/articles/$articleId/edit/page'

export const Route = createFileRoute('/articles/$articleId/edit')({
  component: RouteComponent
})

function RouteComponent() {
  const { articleId } = Route.useParams()
  return <Page articleId={articleId} />
}

