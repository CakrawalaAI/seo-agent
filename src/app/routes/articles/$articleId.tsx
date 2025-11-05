import { createFileRoute } from '@tanstack/react-router'
import { Page } from '@pages/articles/$articleId/page'

export const Route = createFileRoute('/articles/$articleId')({
  component: () => {
    const { articleId } = Route.useParams()
    return <Page articleId={articleId} />
  }
})
