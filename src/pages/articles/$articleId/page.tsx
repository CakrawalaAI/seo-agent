import { useEffect, useMemo, useState } from 'react'
import { ArticleEditor } from '@features/articles/client/ArticleEditor'
import { Button } from '@src/common/ui/button'

type Article = {
  id: string
  websiteId: string
  title: string
  status?: string | null
  bodyHtml?: string | null
  url?: string | null
}

export function Page({ articleId, mode }: { articleId: string; mode?: string | null }) {
  const [article, setArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isEdit = (mode || '').toLowerCase() === 'edit'

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetch(`/api/articles/${articleId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`)))
      .then((data) => {
        if (!alive) return
        setArticle(data as Article)
        setLoading(false)
      })
      .catch((err) => {
        if (!alive) return
        setError(err instanceof Error ? err.message : String(err))
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [articleId])

  const statusLabel = useMemo(() => {
    const s = (article?.status || '').toString().toLowerCase()
    if (!s) return 'draft'
    return s
  }, [article?.status])

  const handleSave = async (bodyHtml: string) => {
    const res = await fetch(`/api/articles/${articleId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ bodyHtml })
    })
    if (!res.ok) throw new Error('Save failed')
    const next = await res.json()
    setArticle(next)
  }

  if (loading) return <div className="mx-auto max-w-4xl p-8 text-muted-foreground">Loading…</div>
  if (error || !article) return <div className="mx-auto max-w-4xl p-8 text-destructive">{error || 'Not found'}</div>

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{article.title || 'Untitled article'}</h1>
          <p className="text-sm text-muted-foreground">Status: {statusLabel}</p>
        </div>
        <div className="flex gap-2">
          <a
            href={`/articles/${articleId}?${isEdit ? '' : 'mode=edit'}`}
            className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
          >
            {isEdit ? 'View' : 'Edit'}
          </a>
          {article.url ? (
            <a
              href={article.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
            >
              Open live
            </a>
          ) : null}
        </div>
      </header>

      {isEdit ? (
        <ArticleEditor initialContent={article.bodyHtml} onSave={handleSave} />
      ) : (
        <article className="prose max-w-none">
          <div dangerouslySetInnerHTML={{ __html: article.bodyHtml || '<p>No content yet.</p>' }} />
        </article>
      )}
    </div>
  )
}

