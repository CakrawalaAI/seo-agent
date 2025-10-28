import { useEffect, useMemo, useState } from 'react'
import { Button } from '@src/common/ui/button'
import { Input } from '@src/common/ui/input'
import { Label } from '@src/common/ui/label'
import { Textarea } from '@src/common/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@src/common/ui/select'
import { Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { extractErrorMessage } from '@common/http/json'
import { formatIntegrationLabel } from '@common/integrations/format'
import {
  getArticle,
  getProjectSnapshot,
  publishArticle,
  updateArticle,
  type UpdateArticlePayload
} from '@entities/article/service'
import type { Article, ProjectIntegration, ProjectSnapshot } from '@entities'

type OutlineSection = {
  heading: string
  subpointsText: string
}

type Notice = {
  id: string
  kind: 'success' | 'error' | 'info'
  text: string
}

type ArticleEditorScreenProps = {
  projectId: string
  articleId: string
}

export function ArticleEditorScreen({ projectId, articleId }: ArticleEditorScreenProps) {
  const queryClient = useQueryClient()

  const [title, setTitle] = useState('')
  const [language, setLanguage] = useState('en')
  const [tone, setTone] = useState('')
  const [outline, setOutline] = useState<OutlineSection[]>([])
  const [notices, setNotices] = useState<Notice[]>([])
  const [selectedIntegration, setSelectedIntegration] = useState<string>('')

  const editor = useEditor({
    extensions: [StarterKit],
    content: '<p></p>',
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none min-h-[320px] rounded-md border border-input bg-background px-3 py-2 focus-visible:outline-none'
      }
    }
  })

  const articleQuery = useQuery<Article>({
    queryKey: ['article', articleId],
    queryFn: () => getArticle(articleId)
  })

  const snapshotQuery = useQuery<ProjectSnapshot>({
    queryKey: ['projectSnapshot', projectId],
    queryFn: () => getProjectSnapshot(projectId),
    staleTime: 30_000
  })

  const article = articleQuery.data ?? null
  const integrations: ProjectIntegration[] = snapshotQuery.data?.integrations ?? []

  const connectedIntegrations = useMemo(
    () => integrations.filter((integration) => integration.status === 'connected'),
    [integrations]
  )

  useEffect(() => {
    if (!selectedIntegration && connectedIntegrations.length > 0) {
      setSelectedIntegration(connectedIntegrations[0]!.id)
    }
  }, [connectedIntegrations, selectedIntegration])

  useEffect(() => {
    if (article) {
      setTitle(article.title ?? '')
      setLanguage(article.language ?? 'en')
      setTone(article.tone ?? '')
      setOutline(normalizeOutline(article.outlineJson ?? []))
      if (editor) {
        editor.commands.setContent(article.bodyHtml ?? '<p></p>')
      }
    }
  }, [article?.id, editor])

  const pushNotice = (kind: Notice['kind'], text: string) => {
    if (!text) return
    const entry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      kind,
      text
    }
    setNotices((prev) => [entry, ...prev].slice(0, 4))
  }

  const dismissNotice = (id: string) => {
    setNotices((prev) => prev.filter((notice) => notice.id !== id))
  }

  const saveMutation = useMutation({
    mutationFn: (payload: UpdateArticlePayload) => updateArticle(articleId, payload),
    onSuccess: (updated) => {
      pushNotice('success', 'Article saved')
      queryClient.invalidateQueries({ queryKey: ['article', articleId] })
      queryClient.invalidateQueries({ queryKey: ['articles', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projectSnapshot', projectId] })
      if (updated?.title) {
        setTitle(updated.title)
      }
    },
    onError: (error) => pushNotice('error', extractErrorMessage(error))
  })

  const publishMutation = useMutation({
    mutationFn: (integrationId: string) => publishArticle(articleId, integrationId),
    onSuccess: (result) => {
      pushNotice('success', `Publish job ${result?.jobId ?? 'enqueued'}`)
      queryClient.invalidateQueries({ queryKey: ['articles', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projectSnapshot', projectId] })
    },
    onError: (error) => pushNotice('error', extractErrorMessage(error))
  })

  const handleSave = () => {
    const bodyHtml = editor?.getHTML() ?? article?.bodyHtml ?? ''
    const outlineJson = serializeOutline(outline)
    saveMutation.mutate({
      title,
      language,
      tone: tone || undefined,
      bodyHtml,
      outlineJson
    })
  }

  const handlePublish = () => {
    if (!selectedIntegration) {
      pushNotice('error', 'Select an integration before publishing')
      return
    }
    publishMutation.mutate(selectedIntegration)
  }

  const heading = article
    ? `${article.title}${article.status === 'published' ? ' (published)' : ''}`
    : 'Loading…'

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          <Link to="/projects" className="text-primary hover:underline">
            Projects
          </Link>{' '}
          /{' '}
          <Link to="/projects/$projectId" params={{ projectId }} className="text-primary hover:underline">
            Project
          </Link>{' '}
          / Article
        </p>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-foreground">{heading}</h1>
            <p className="text-xs text-muted-foreground">
              Article ID {articleId} · Status {article?.status?.toUpperCase() ?? '—'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/projects/$projectId"
              params={{ projectId }}
              search={{ tab: 'articles' }}
              className="rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-muted"
            >
              ← Back to articles
            </Link>
            <Button
              type="button"
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
              onClick={handleSave}
              disabled={saveMutation.isPending || articleQuery.isLoading}
            >
              {saveMutation.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </div>
      </header>

      {notices.length > 0 ? (
        <section className="flex flex-col gap-2">
          {notices.map((notice) => (
            <div
              key={notice.id}
              className={`flex items-start justify-between gap-3 rounded-md border p-3 text-sm ${noticeKindClass(notice.kind)}`}
            >
              <p className="leading-snug">{notice.text}</p>
              <Button
                type="button"
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
                onClick={() => dismissNotice(notice.id)}
              >
                Dismiss
              </Button>
            </div>
          ))}
        </section>
      ) : null}

      {articleQuery.isLoading ? (
        <section className="rounded-lg border bg-card p-6 text-sm text-muted-foreground shadow-sm">
          Loading article…
        </section>
      ) : articleQuery.isError || !article ? (
        <section className="rounded-lg border bg-card p-6 text-sm text-destructive shadow-sm">
          Unable to load article. Return to the project and try again.
        </section>
      ) : (
        <div className="space-y-6">
          <section className="grid gap-4 md:grid-cols-2">
            <Label className="flex flex-col gap-1 text-sm font-medium text-muted-foreground">
              Title
              <Input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              />
            </Label>
            <div className="grid gap-3 sm:grid-cols-2">
              <Label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Language
                <Input
                  type="text"
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                />
              </Label>
              <Label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Tone
                <Input
                  type="text"
                  value={tone}
                  onChange={(event) => setTone(event.target.value)}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                />
              </Label>
            </div>
          </section>

          <section className="space-y-3">
            <header className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-foreground">Outline</h2>
              <Button
                type="button"
                className="rounded-md border border-input px-3 py-1 text-xs font-medium hover:bg-muted"
                onClick={() =>
                  setOutline((prev) => [...prev, { heading: 'New section', subpointsText: '' }])
                }
              >
                Add section
              </Button>
            </header>
            {outline.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No outline yet. Add sections to guide long-form generation.
              </p>
            ) : (
              <div className="space-y-3">
                {outline.map((section, index) => (
                  <div key={`${section.heading}-${index}`} className="rounded-md border bg-card p-3 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase text-muted-foreground">
                        Section {index + 1}
                      </span>
                      <Button
                        type="button"
                        className="text-xs font-medium text-destructive hover:underline"
                        onClick={() =>
                          setOutline((prev) => prev.filter((_, idx) => idx !== index))
                        }
                      >
                        Remove
                      </Button>
                    </div>
                    <Label className="mt-2 flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                      Heading
                      <Input
                        type="text"
                        value={section.heading}
                        onChange={(event) =>
                          setOutline((prev) =>
                            prev.map((item, idx) =>
                              idx === index ? { ...item, heading: event.target.value } : item
                            )
                          )
                        }
                        className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                      />
                    </Label>
                    <Label className="mt-3 flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                      Bullet points (one per line)
                      <Textarea
                        value={section.subpointsText}
                        onChange={(event) =>
                          setOutline((prev) =>
                            prev.map((item, idx) =>
                              idx === index ? { ...item, subpointsText: event.target.value } : item
                            )
                          )
                        }
                        rows={4}
                        className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                      />
                    </Label>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <header className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-foreground">Body</h2>
              <span className="text-xs text-muted-foreground">
                Rich-text editing powered by Tiptap.
              </span>
            </header>
            <div className="rounded-md border bg-card p-2 shadow-sm">
              <EditorContent editor={editor} />
            </div>
          </section>

          <section className="rounded-lg border bg-card p-4 shadow-sm">
            <header className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Publish</h3>
                <p className="text-xs text-muted-foreground">
                  Choose an integration to push the latest draft live.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={selectedIntegration || undefined}
                  onValueChange={(v) => setSelectedIntegration(v)}
                  disabled={connectedIntegrations.length === 0 || publishMutation.isPending}
                >
                  <SelectTrigger className="w-[240px] text-xs">
                    <SelectValue placeholder="Select integration" />
                  </SelectTrigger>
                  <SelectContent>
                    {connectedIntegrations.map((integration: ProjectIntegration) => (
                      <SelectItem key={integration.id} value={integration.id}>
                        {integration.type} · {formatIntegrationLabel(integration)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={handlePublish}
                  disabled={
                    publishMutation.isPending ||
                    connectedIntegrations.length === 0 ||
                    !selectedIntegration
                  }
                >
                  {publishMutation.isPending ? 'Publishing…' : 'Publish'}
                </Button>
              </div>
            </header>
            {connectedIntegrations.length === 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">
                No connected integrations yet. Add a webhook or CMS connector from the project page.
              </p>
            ) : null}
          </section>
        </div>
      )}
    </div>
  )
}

function normalizeOutline(value: unknown): OutlineSection[] {
  if (!Array.isArray(value)) return []
  return value
    .map((section) => {
      if (!section || typeof section !== 'object') {
        return null
      }
      const record = section as Record<string, unknown>
      const heading = typeof record.heading === 'string' ? record.heading : ''
      const subpointsRaw = Array.isArray(record.subpoints)
        ? record.subpoints.filter((point): point is string => typeof point === 'string')
        : []
      return {
        heading,
        subpointsText: subpointsRaw.join('\n')
      }
    })
    .filter((section): section is OutlineSection => Boolean(section && (section.heading || section.subpointsText)))
}

function serializeOutline(outline: OutlineSection[]) {
  return outline
    .map((section) => ({
      heading: section.heading.trim() || 'Outline item',
      subpoints: section.subpointsText
        ? section.subpointsText
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
        : []
    }))
    .filter((section) => section.heading.length > 0)
}

function noticeKindClass(kind: Notice['kind']) {
  switch (kind) {
    case 'success':
      return 'border-emerald-400 bg-emerald-50 text-emerald-800'
    case 'error':
      return 'border-destructive bg-destructive/10 text-destructive'
    default:
      return 'border-primary/40 bg-primary/10 text-primary'
  }
}
