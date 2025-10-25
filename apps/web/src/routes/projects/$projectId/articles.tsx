// @ts-nocheck
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import type { Article } from '@seo-agent/domain'
import { useProjectLayout } from './__layout'

type ArticleResponse = {
  items: Article[]
  nextCursor?: string
}

const fetchArticles = async (projectId: string): Promise<ArticleResponse> => {
  const params = new URLSearchParams({ projectId, limit: '60' })
  const response = await fetch(`/api/articles?${params.toString()}`, {
    credentials: 'include'
  })
  if (!response.ok) {
    throw new Error('Failed to load articles')
  }
  return (await response.json()) as ArticleResponse
}

export const Route = createFileRoute('/projects/$projectId/articles')({
  component: ArticlesPage
})

function ArticlesPage() {
  const { projectId } = useProjectLayout()

  const articlesQuery = useQuery({
    queryKey: ['project', projectId, 'articles'],
    queryFn: () => fetchArticles(projectId),
    staleTime: 60_000,
    refetchInterval: 120_000
  })

  const drafts = useMemo(
    () => (articlesQuery.data?.items ?? []).filter((article) => article.status === 'draft'),
    [articlesQuery.data?.items]
  )
  const published = useMemo(
    () => (articlesQuery.data?.items ?? []).filter((article) => article.status === 'published'),
    [articlesQuery.data?.items]
  )

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Articles</p>
        <h2 className="text-2xl font-semibold">Daily drafts & autopublished posts</h2>
        <p className="text-sm text-muted-foreground">
          Drafts generate lazily each morning. Approve or edit them here before publishing through your integration.
        </p>
      </header>

      {articlesQuery.isLoading ? (
        <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-sm text-muted-foreground">
          Loading articles…
        </div>
      ) : articlesQuery.isError ? (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-6 text-sm text-destructive">
          Unable to load articles. Refresh the page or check the worker logs.
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <ArticleColumn title="Drafts" emptyMessage="No drafts yet. Run the scheduler or wait for the next generation window." articles={drafts} />
          <ArticleColumn
            title="Published"
            emptyMessage="No published articles. Auto-publish will send drafts live once the buffer clears."
            articles={published}
          />
        </div>
      )}
    </section>
  )
}

type ArticleColumnProps = {
  title: string
  emptyMessage: string
  articles: Article[]
}

const ArticleColumn = ({ title, emptyMessage, articles }: ArticleColumnProps) => {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
          {articles.length}
        </span>
      </div>
      {articles.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/10 p-4 text-xs text-muted-foreground">
          {emptyMessage}
        </div>
      ) : (
        <div className="space-y-4">
          {articles.map((article) => (
            <article key={article.id} className="rounded-lg border bg-card p-4 shadow-sm">
              <header className="flex items-start justify-between gap-3">
                <h4 className="text-sm font-semibold text-foreground">{article.title}</h4>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {article.status === 'draft' ? 'Draft' : 'Published'}
                </span>
              </header>
              <p className="mt-2 text-xs text-muted-foreground">Keyword ID: {article.keywordId ?? '—'}</p>
              <p className="mt-2 line-clamp-3 text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: article.bodyHtml }} />
              <dl className="mt-4 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                <div>
                  <dt className="uppercase tracking-wide">Generated</dt>
                  <dd className="font-medium text-foreground">{formatDate(article.generationDate)}</dd>
                </div>
                <div>
                  <dt className="uppercase tracking-wide">Published</dt>
                  <dd className="font-medium text-foreground">{formatDate(article.publicationDate)}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

const formatDate = (value: string | null | undefined) => {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString()
}

