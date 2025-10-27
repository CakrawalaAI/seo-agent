import { createFileRoute } from '@tanstack/react-router'
import { loader } from '@pages/projects/$projectId/articles/$articleId/loader'
import { Page } from '@pages/projects/$projectId/articles/$articleId/page'

export const Route = createFileRoute('/projects/$projectId/articles/$articleId')({
  loader,
  component: ArticleEditorRoute
})

function ArticleEditorRoute() {
  const { projectId, articleId } = Route.useParams()
  return <Page projectId={projectId} articleId={articleId} />
}
