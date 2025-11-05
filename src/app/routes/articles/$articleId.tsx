import { createFileRoute, redirect } from '@tanstack/react-router'
import { Page } from '@pages/articles/$articleId/page'
import { fetchSession } from '@entities/org/service'

export const Route = createFileRoute('/articles/$articleId')({
  beforeLoad: async () => {
    try {
      const data = await fetchSession()
      if (!data?.user) throw redirect({ to: '/' })
    } catch {
      throw redirect({ to: '/' })
    }
  },
  component: () => {
    const { articleId } = Route.useParams()
    return <Page articleId={articleId} />
  }
})
