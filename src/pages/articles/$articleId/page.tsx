import { useMemo } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { getArticle, updateArticle, publishArticle as publishArticleApi } from '@entities/article/service'
import { getWebsiteSnapshot } from '@entities/website/service'
import type { Article } from '@entities'
import { Button } from '@src/common/ui/button'
import { Badge } from '@src/common/ui/badge'
import { ArticleEditor } from '@features/articles/client/ArticleEditor'

type PageProps = { articleId: string }

export function Page({ articleId }: PageProps): JSX.Element {
  const articleQuery = useQuery({ queryKey: ['article.detail', articleId], queryFn: () => getArticle(articleId) })
  const websiteId = articleQuery.data?.article?.websiteId ?? null
  const snapshotQuery = useQuery({
    queryKey: ['integrations.snapshot', websiteId],
    queryFn: () => getWebsiteSnapshot(String(websiteId), { cache: 'no-store' }),
    enabled: Boolean(websiteId)
  })

  const activeIntegrations = useMemo(() => {
    const list = (snapshotQuery.data?.integrations ?? []) as Array<any>
    return list.filter((i) => i.status === 'connected') as Array<any>
  }, [snapshotQuery.data])

  const activeWebhookId = useMemo(() => {
    const w = activeIntegrations.find((i) => i.type === 'webhook')
    return w?.id ? String(w.id) : null
  }, [activeIntegrations])

  const saveMutation = useMutation({
    mutationFn: async (html: string) => {
      const a = articleQuery.data?.article as Article | undefined
      if (!a) return
      await updateArticle(a.id, {
        title: a.title || 'Untitled',
        language: a.language || 'en',
        tone: a.tone || undefined,
        bodyHtml: html,
        outlineJson: (a.outlineJson as any) || []
      })
    },
    onSuccess: () => articleQuery.refetch().catch(() => undefined)
  })

  const publishAllMutation = useMutation({
    mutationFn: async () => {
      const a = articleQuery.data?.article as Article | undefined
      if (!a) return
      for (const integ of activeIntegrations) {
        try { await publishArticleApi(a.id, String(integ.id)) } catch {}
      }
    }
  })

  const publishWebhookMutation = useMutation({
    mutationFn: async () => {
      const a = articleQuery.data?.article as Article | undefined
      if (!a || !activeWebhookId) return
      await publishArticleApi(a.id, activeWebhookId)
    }
  })

  const article = articleQuery.data?.article
  const title = article?.title || 'Untitled article'
  const status = (article?.status || 'queued') as string
  const initialBody = useMemo(() => {
    const body = typeof article?.bodyHtml === 'string' ? String(article.bodyHtml) : ''
    const fromPayload =
      article && (article as any).payloadJson && typeof (article as any).payloadJson.bodyHtml === 'string'
        ? String((article as any).payloadJson.bodyHtml)
        : ''
    const hasContent = (s: string) => s.replace(/<[^>]+>/g, ' ').trim().length > 0
    return hasContent(body) ? body : fromPayload
  }, [article])

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{title}</h1>
          <div className="text-xs text-muted-foreground">Article ID: {articleId}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={status === 'published' ? 'default' : status === 'scheduled' ? 'secondary' : status === 'unpublished' ? 'destructive' : 'outline'} className="uppercase">
            {status}
          </Badge>
          <Button type="button" size="sm" disabled={publishAllMutation.isPending || !activeIntegrations.length} onClick={() => publishAllMutation.mutate()}>
            {publishAllMutation.isPending ? 'Publishing…' : 'Publish'}
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={!activeWebhookId || publishWebhookMutation.isPending} onClick={() => publishWebhookMutation.mutate()}>
            {publishWebhookMutation.isPending ? 'Publishing…' : 'Publish via Webhook'}
          </Button>
        </div>
      </header>

      <section className="rounded-lg border bg-card p-0 shadow-sm">
        <ArticleEditor
          initialContent={initialBody}
          onSave={(html) => saveMutation.mutate(html)}
          showSaveButton
        />
      </section>
    </div>
  )
}
