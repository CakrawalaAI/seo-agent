import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { ArrowLeft, ExternalLink } from 'lucide-react'

import { useMockData } from '@common/dev/mock-data-context'
import { useActiveWebsite } from '@common/state/active-website'
import { formatDateTime } from '@src/common/ui/format'
import { Button } from '@src/common/ui/button'
import { Input } from '@src/common/ui/input'
import { Skeleton } from '@src/common/ui/skeleton'
import { toast } from 'sonner'
import { ArticleEditor } from '@features/articles/client/ArticleEditor'
import { useArticleNavigation } from '@features/articles/shared/use-article-navigation'
import { getArticle, updateArticle, type ArticleDetail } from '@entities/article/service'
import type { ArticleGenerationPayload } from '@entities'
import type { ArticleOutlineSection } from '@entities/article/domain/article'
import { log } from '@src/common/logger'

type PageProps = {
  articleId: string
}

export function Page({ articleId }: PageProps): JSX.Element {
  const { enabled: mockEnabled } = useMockData()
  const { goToArticlesIndex } = useArticleNavigation()
  const { id: projectId } = useActiveWebsite()
  const router = useRouter()
  const history = router.history
  const queryClient = useQueryClient()

  const detailQuery = useQuery({
    queryKey: ['articles.detail', articleId],
    queryFn: () => getArticle(articleId),
    enabled: Boolean(articleId) && !mockEnabled
  })

  const detail: ArticleDetail | undefined = useMemo(() => {
    if (mockEnabled) return buildMockDetail(articleId, projectId)
    return detailQuery.data
  }, [articleId, detailQuery.data, mockEnabled, projectId])

  const [title, setTitle] = useState('')
  const [bodyHtml, setBodyHtml] = useState('')
  const [status, setStatus] = useState<string>('')
  const [scheduledDate, setScheduledDate] = useState<string | null>(null)
  const [publishDate, setPublishDate] = useState<string | null>(null)
  const [locale, setLocale] = useState<string>('')
  const [keyword, setKeyword] = useState<string | null>(null)
  const [tone, setTone] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)

  const initialTitleRef = useRef('')
  const initialBodyRef = useRef('')
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!detail) return
    const currentTitle = detail.article.title ?? ''
    const currentBody = detail.article.bodyHtml ?? ''
    setTitle(currentTitle)
    setBodyHtml(currentBody)
    setStatus(detail.article.status ?? 'draft')
    setScheduledDate(detail.article.scheduledDate ?? null)
    setPublishDate(detail.article.publishDate ?? null)
    setLocale(detail.article.language ?? '')
    setKeyword(detail.article.targetKeyword ?? null)
    setTone(detail.article.tone ?? null)
    initialTitleRef.current = currentTitle
    initialBodyRef.current = currentBody
    setLastSavedAt(detail.article.updatedAt ? new Date(detail.article.updatedAt) : null)
  }, [detail])

  const isDirty = useMemo(() => {
    return initialTitleRef.current !== title || initialBodyRef.current !== bodyHtml
  }, [title, bodyHtml])

  const wordCount = useMemo(() => estimateWords(bodyHtml), [bodyHtml])
  const readingMinutes = useMemo(() => (wordCount ? Math.max(1, Math.round(wordCount / 200)) : 0), [wordCount])

  const handlePreview = useCallback(() => {
    if (!detail?.article?.url) return
    window.open(detail.article.url, '_blank', 'noopener')
  }, [detail])

  const handleSave = useCallback(async () => {
    if (!detail || mockEnabled) return
    const nextTitle = title.trim() || 'Untitled article'
    if (!isDirty) return
    setIsSaving(true)
    setSaveError(null)
    try {
      const outline: ArticleOutlineSection[] = Array.isArray(detail.article.outlineJson)
        ? (detail.article.outlineJson as ArticleOutlineSection[])
        : []
      const updated = await updateArticle(articleId, {
        title: nextTitle,
        language: detail.article.language ?? 'en',
        tone: detail.article.tone ?? undefined,
        bodyHtml,
        outlineJson: outline
      })
      if (projectId) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['articles.list', projectId] }),
          queryClient.invalidateQueries({ queryKey: ['articles.plan', projectId] })
        ])
      }
      const refreshed = updated ?? (await detailQuery.refetch()).data
      if (refreshed) {
        const freshTitle = refreshed.article.title ?? ''
        const freshBody = refreshed.article.bodyHtml ?? ''
        initialTitleRef.current = freshTitle
        initialBodyRef.current = freshBody
        setTitle(freshTitle)
        setBodyHtml(freshBody)
        setStatus(refreshed.article.status ?? status)
        setScheduledDate(refreshed.article.scheduledDate ?? null)
        setPublishDate(refreshed.article.publishDate ?? null)
        setLocale(refreshed.article.language ?? '')
        setTone(refreshed.article.tone ?? null)
        setKeyword(refreshed.article.targetKeyword ?? null)
        const stamped = refreshed.article.updatedAt ? new Date(refreshed.article.updatedAt) : new Date()
        setLastSavedAt(stamped)
      } else {
        setLastSavedAt(new Date())
      }
      log.info('[articles.detail.page] save_success', { articleId })
      toast.success('Draft saved')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save article'
      setSaveError(message)
      log.error('[articles.detail.page] save_error', { articleId, message })
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }, [articleId, bodyHtml, detail, detailQuery, isDirty, mockEnabled, projectId, queryClient, status, title])

  const saveDisabled = mockEnabled || isSaving || !isDirty

  useEffect(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = null
    }
    if (mockEnabled || saveDisabled) return
    autoSaveTimerRef.current = setTimeout(() => {
      autoSaveTimerRef.current = null
      void handleSave()
    }, 5000)
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
        autoSaveTimerRef.current = null
      }
    }
  }, [handleSave, mockEnabled, saveDisabled, title, bodyHtml])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const originalTitle = document.title
    document.title = title ? `${title} – SEO Agent` : originalTitle
    return () => {
      document.title = originalTitle
    }
  }, [title])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!isDirty) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && (event.key === 's' || event.key === 'S')) {
        event.preventDefault()
        if (!saveDisabled) {
          void handleSave()
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleSave, saveDisabled])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!isDirty || mockEnabled) return
    const unblock = history.block({
      enableBeforeUnload: true,
      blockerFn: () => {
        const confirmLeave = window.confirm('You have unsaved changes. Leave without saving?')
        return !confirmLeave
      }
    })
    return () => unblock()
  }, [history, isDirty, mockEnabled])

  const isLoading = detailQuery.isLoading && !detail

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-12" />
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 text-center">
        <h2 className="text-xl font-semibold">Article not found</h2>
        <p className="text-sm text-muted-foreground">
          We couldn&apos;t locate that article. It may have been deleted or you might not have access.
        </p>
        <Button variant="secondary" onClick={() => goToArticlesIndex()}>
          Back to Articles
        </Button>
      </div>
    )
  }

  const statusMessage = saveError
    ? saveError
    : isSaving
    ? 'Saving…'
    : isDirty
    ? 'Unsaved changes'
    : lastSavedAt
    ? `Saved ${formatDateTime(lastSavedAt.toISOString())}`
    : 'Ready'

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 pb-16">
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="sm" onClick={() => goToArticlesIndex()}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back
        </Button>
        <div className="ml-auto flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {mockEnabled ? <span>Mock data mode — changes disabled</span> : null}
          <span className={saveError ? 'text-destructive' : isDirty ? 'text-primary' : undefined}>{statusMessage}</span>
        </div>
      </div>

      <Input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Add title"
        disabled={mockEnabled}
        className="border-0 px-0 text-3xl font-semibold tracking-tight focus-visible:ring-0"
      />

      <div className="flex flex-wrap gap-4 rounded-md border bg-muted/20 px-4 py-3 text-sm">
        <MetaChip label="Status" value={status || '—'} />
        <MetaChip label="Scheduled" value={formatDateTime(scheduledDate)} />
        <MetaChip label="Publish" value={formatDateTime(publishDate)} />
        <MetaChip label="Locale" value={locale || '—'} />
        {keyword ? <MetaChip label="Keyword" value={keyword} /> : null}
        {tone ? <MetaChip label="Tone" value={tone} /> : null}
        <MetaChip label="Word Count" value={wordCount ? `${wordCount.toLocaleString()} words` : '—'} />
        <MetaChip label="Reading Time" value={readingMinutes ? `${readingMinutes} min` : '—'} />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handlePreview}
          disabled={!detail.article.url}
        >
          Preview
          <ExternalLink className="ml-1.5 h-4 w-4" />
        </Button>
        <Button type="button" onClick={handleSave} disabled={saveDisabled}>
          {isSaving ? 'Saving…' : isDirty ? 'Save Draft' : 'Saved'}
        </Button>
      </div>

      <ArticleEditor
        key={articleId}
        initialContent={bodyHtml}
        onChange={setBodyHtml}
        showSaveButton={false}
        placeholder="Write your article content here..."
        className="shadow-sm"
        readOnly={mockEnabled}
      />
    </div>
  )
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 text-muted-foreground">
      <span className="text-[11px] uppercase tracking-wide">{label}</span>
      <span className="text-sm font-medium text-foreground">{value || '—'}</span>
    </div>
  )
}

function estimateWords(html?: string | null): number {
  if (!html) return 0
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  if (!text) return 0
  return text.split(' ').length
}

function buildMockDetail(articleId: string, projectId?: string | null): ArticleDetail {
  const now = new Date()
  const article = {
    id: articleId,
    websiteId: projectId || 'proj_mock',
    title: 'Mock Article — How to Structure STAR Responses',
    targetKeyword: 'STAR method interview example',
    language: 'en-US',
    tone: 'authoritative',
    status: 'scheduled',
    outlineJson: [
      { heading: 'Introduction' },
      { heading: 'Step-by-Step STAR Breakdown' },
      { heading: 'Sample Answers' },
      { heading: 'Common Mistakes' },
      { heading: 'Conclusion' }
    ],
    bodyHtml: '<h2>Mock Content</h2><p>This is sample content for offline usage.</p>',
    scheduledDate: new Date(now.getTime() + 86_400_000).toISOString(),
    publishDate: null,
    url: null,
    payloadJson: {
      version: 1,
      articleId,
      websiteId: projectId || 'proj_mock',
      title: 'Mock Article — How to Structure STAR Responses',
      targetKeyword: 'STAR method interview example',
      locale: 'en-US',
      outline: [
        { heading: 'Introduction' },
        { heading: 'STAR Overview' },
        { heading: 'Sample Answers' }
      ],
      bodyHtml: '<h2>Mock Content</h2><p>This is sample content for offline usage.</p>',
      wordCount: 540,
      readingMinutes: 3,
      generatedAt: now.toISOString(),
      context: {
        features: {
          serp: false,
          youtube: false,
          imageUnsplash: false,
          imageAi: false,
          research: false,
          attachments: false
        },
        citations: [],
        youtube: [],
        internalLinks: [],
        images: [],
        serpDump: '',
        websiteSummary: 'Mock summary for the selected website.'
      }
    } satisfies ArticleGenerationPayload,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    generationDate: now.toISOString()
  }

  return {
    article: article as any,
    attachments: []
  }
}
