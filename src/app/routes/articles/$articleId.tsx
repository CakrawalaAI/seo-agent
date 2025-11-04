import { createFileRoute, redirect } from '@tanstack/react-router'
import { Page } from '@pages/articles/$articleId/page'

export const Route = createFileRoute('/articles/$articleId')({
  beforeLoad: async () => {
    try {
      const res = await fetch('/api/me', { headers: { accept: 'application/json' } })
      const data = res.ok ? await res.json() : null
      if (!data?.user) throw redirect({ to: '/' })
    } catch {
      throw redirect({ to: '/' })
    }
  },
  component: () => {
    const { articleId } = Route.useParams()
    const search = Route.useSearch() as { mode?: string | null }
    return <Page articleId={articleId} mode={typeof search?.mode === 'string' ? search.mode : null} />
  }
})

