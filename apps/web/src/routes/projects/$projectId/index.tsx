// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  closePlanEditor,
  createIdlePlanEditState,
  createIdlePublishState,
  openPlanEditor,
  planEditorSubmitError,
  planEditorSubmitSuccess,
  publishErrored,
  publishQueued,
  publishSubmitting,
  resetPublishState,
  submitPlanEditor,
  type PlanEditState,
  type PublishState,
  updatePlanEditorDate
} from './state-machines'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'crawl', label: 'Crawl' },
  { key: 'keywords', label: 'Keywords' },
  { key: 'plan', label: 'Calendar' },
  { key: 'articles', label: 'Articles' },
  { key: 'integrations', label: 'Integrations' }
] as const

const DEFAULT_TAB = 'overview'

export const Route = createFileRoute('/projects/$projectId')({
  component: ProjectDetailPage
})

function ProjectDetailPage() {
  const { projectId } = Route.useParams()
  const search = Route.useSearch()
  const queryClient = useQueryClient()

  const [notices, setNotices] = useState([])
  const [planEditState, setPlanEditState] = useState<PlanEditState>(() => createIdlePlanEditState())
  const [testingIntegrationId, setTestingIntegrationId] = useState(null)
  const [publishState, setPublishState] = useState<PublishState>(() => createIdlePublishState())
  const publishResetRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearPublishReset = () => {
    if (publishResetRef.current) {
      clearTimeout(publishResetRef.current)
      publishResetRef.current = null
    }
  }

  useEffect(() => {
    return () => {
      clearPublishReset()
    }
  }, [])

  const activeTab = useMemo(() => {
    const requested = typeof search?.tab === 'string' ? search.tab : ''
    return TABS.some((tab) => tab.key === requested) ? requested : DEFAULT_TAB
  }, [search?.tab])

  const pushNotice = (kind: 'success' | 'error' | 'info', text: string) => {
    if (!text) return
    const entry = {
      id: `notice-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      kind,
      text
    }
    setNotices((prev) => [entry, ...prev].slice(0, 5))
  }

  const dismissNotice = (id: string) => {
    setNotices((prev) => prev.filter((notice) => notice.id !== id))
  }

  const openPlanEdit = (item: any) => {
    if (!item) return
    setPlanEditState(openPlanEditor(item))
  }

  const updatePlanEditDate = (value: string) => {
    setPlanEditState((prev) => updatePlanEditorDate(prev, value))
  }

  const closePlanEdit = () => {
    setPlanEditState((prev) => closePlanEditor(prev))
  }

  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => fetchJson(`/api/projects/${projectId}`),
    staleTime: 60_000
  })

  const snapshotQuery = useQuery({
    queryKey: ['projectSnapshot', projectId],
    queryFn: () => fetchJson(`/api/projects/${projectId}/snapshot`),
    staleTime: 30_000
  })

  const project = projectQuery.data ?? null
  const snapshot = snapshotQuery.data ?? null

  const connectedIntegrations = useMemo(
    () => (snapshot?.integrations ?? []).filter((integration) => integration.status === 'connected'),
    [snapshot?.integrations]
  )

  const startCrawlMutation = useMutation({
    mutationFn: () => postJson('/api/crawl/run', { projectId }),
    onSuccess: (result) => {
      pushNotice('success', `Crawl job ${result?.jobId ?? 'enqueued'}`)
      queryClient.invalidateQueries({ queryKey: ['projectSnapshot', projectId] })
      queryClient.invalidateQueries({ queryKey: ['crawlPages', projectId] })
    },
    onError: (error) => pushNotice('error', extractErrorMessage(error))
  })

  const generateKeywordsMutation = useMutation({
    mutationFn: () =>
      postJson('/api/keywords/generate', {
        projectId,
        locale: project?.defaultLocale ?? 'en-US'
      }),
    onSuccess: (result) => {
      pushNotice('success', `Discovery job ${result?.jobId ?? 'enqueued'}`)
      queryClient.invalidateQueries({ queryKey: ['keywords', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projectSnapshot', projectId] })
    },
    onError: (error) => pushNotice('error', extractErrorMessage(error))
  })

  const createPlanMutation = useMutation({
    mutationFn: () =>
      postJson('/api/plan/create', {
        projectId,
        days: 30
      }),
    onSuccess: (result) => {
      pushNotice('success', `Plan job ${result?.jobId ?? 'enqueued'}`)
      queryClient.invalidateQueries({ queryKey: ['plan', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projectSnapshot', projectId] })
    },
    onError: (error) => pushNotice('error', extractErrorMessage(error))
  })

  const runScheduleMutation = useMutation({
    mutationFn: () =>
      postJson('/api/schedules/run', {
        projectId
      }),
    onSuccess: (result) => {
      const published = result?.result?.publishedArticles ?? 0
      const drafts = result?.result?.generatedDrafts ?? 0
      pushNotice(
        'success',
        `Schedule run enqueued ${drafts} draft${drafts === 1 ? '' : 's'} and ${published} publish${published === 1 ? '' : 'es'}`
      )
      queryClient.invalidateQueries({ queryKey: ['articles', projectId] })
      queryClient.invalidateQueries({ queryKey: ['plan', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projectSnapshot', projectId] })
    },
    onError: (error) => pushNotice('error', extractErrorMessage(error))
  })

  const rescheduleMutation = useMutation({
    mutationFn: ({ planItemId, plannedDate }: { planItemId: string; plannedDate: string }) =>
      patchJson(`/api/plan/${planItemId}`, {
        plannedDate
      }),
    onMutate: ({ planItemId, plannedDate }) => {
      setPlanEditState((prev) => submitPlanEditor(prev, { planItemId, plannedDate }))
    },
    onSuccess: (updated, variables) => {
      const nextDate = updated?.plannedDate ?? variables.plannedDate
      pushNotice('success', `Plan item moved to ${nextDate}`)
      queryClient.invalidateQueries({ queryKey: ['plan', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projectSnapshot', projectId] })
      setPlanEditState(planEditorSubmitSuccess())
    },
    onError: (error, variables) => {
      const message = extractErrorMessage(error)
      setPlanEditState((prev) => planEditorSubmitError(prev, { planItemId: variables.planItemId, message }))
      pushNotice('error', message)
    }
  })

  const crawlPagesQuery = useQuery({
    queryKey: ['crawlPages', projectId],
    queryFn: () => fetchJson(`/api/projects/${projectId}/crawl-pages?limit=100`),
    enabled: activeTab === 'crawl'
  })

  const keywordsQuery = useQuery({
    queryKey: ['keywords', projectId],
    queryFn: () => fetchJson(`/api/projects/${projectId}/keywords?limit=100`),
    enabled: activeTab === 'keywords'
  })

  const planQuery = useQuery({
    queryKey: ['plan', projectId],
    queryFn: () => fetchJson(`/api/projects/${projectId}/plan?limit=90`),
    enabled: activeTab === 'plan'
  })

  const articlesQuery = useQuery({
    queryKey: ['articles', projectId],
    queryFn: () => fetchJson(`/api/projects/${projectId}/articles?limit=90`),
    enabled: activeTab === 'articles' || activeTab === 'plan'
  })

  const publishArticleMutation = useMutation({
    mutationFn: ({ articleId, integrationId }: { articleId: string; integrationId: string }) =>
      postJson(`/api/articles/${articleId}/publish`, {
        integrationId
      }),
    onMutate: ({ articleId, integrationId }) => {
      clearPublishReset()
      setPublishState((prev) => publishSubmitting(prev, { articleId, integrationId }))
    },
    onSuccess: (result, variables) => {
      pushNotice('success', `Publish job ${result?.jobId ?? 'queued'}`)
      queryClient.invalidateQueries({ queryKey: ['articles', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projectSnapshot', projectId] })
      setPublishState((prev) => publishQueued(prev, { articleId: variables.articleId, jobId: result?.jobId }))
      publishResetRef.current = setTimeout(() => {
        setPublishState(() => resetPublishState())
        publishResetRef.current = null
      }, 4000)
    },
    onError: (error, variables) => {
      const message = extractErrorMessage(error)
      pushNotice('error', message)
      clearPublishReset()
      setPublishState((prev) =>
        publishErrored(prev, {
          articleId: variables.articleId,
          integrationId: variables.integrationId,
          message
        })
      )
    }
  })

  const testIntegrationMutation = useMutation({
    mutationFn: (integrationId: string) => postJson(`/api/integrations/${integrationId}/test`, {}),
    onMutate: (integrationId) => {
      setTestingIntegrationId(integrationId)
    },
    onSuccess: () => {
      pushNotice('success', 'Integration test event delivered')
    },
    onError: (error) => pushNotice('error', extractErrorMessage(error)),
    onSettled: () => setTestingIntegrationId(null)
  })

  const createWebhookMutation = useMutation({
    mutationFn: ({ targetUrl, secret }: { targetUrl: string; secret: string }) =>
      postJson('/api/integrations', {
        projectId,
        type: 'webhook',
        config: { targetUrl, secret },
        status: 'connected'
      }),
    onSuccess: () => {
      pushNotice('success', 'Webhook integration created')
      queryClient.invalidateQueries({ queryKey: ['projectSnapshot', projectId] })
    },
    onError: (error) => pushNotice('error', extractErrorMessage(error))
  })

  if (projectQuery.isLoading) {
    return (
      <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-6 py-12">
        <p className="text-sm text-muted-foreground">Loading project…</p>
      </main>
    )
  }

  if (projectQuery.isError || !project) {
    return (
      <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-6 py-12">
        <p className="text-sm text-destructive">Project not found. Try returning to the projects list.</p>
        <Link
          to="/projects"
          className="inline-flex w-max items-center gap-2 rounded-md border border-input px-3 py-1.5 text-sm font-medium text-primary hover:bg-muted"
        >
          ← Back to projects
        </Link>
      </main>
    )
  }

  const crawlPages = crawlPagesQuery.data?.items ?? []
  const keywords = keywordsQuery.data?.items ?? []
  const mergedPlanItems = useMemo(() => {
    const base = snapshot?.planItems ?? []
    const override = planQuery.data?.items ?? []
    if (!override.length) {
      return base
    }
    const map = new Map()
    for (const item of base) {
      map.set(item.id, item)
    }
    for (const item of override) {
      map.set(item.id, item)
    }
    return Array.from(map.values()).sort((a, b) => a.plannedDate.localeCompare(b.plannedDate))
  }, [snapshot?.planItems, planQuery.data?.items])

  const articles = articlesQuery.data?.items ?? []

  const articlesByPlanId = useMemo(() => {
    const map = new Map()
    for (const article of articles) {
      if (article.planItemId) {
        map.set(article.planItemId, article)
      }
    }
    return map
  }, [articles])

  const planItemMap = useMemo(() => {
    const map = new Map()
    for (const item of mergedPlanItems) {
      map.set(item.id, item)
    }
    return map
  }, [mergedPlanItems])

  const planEditOpen = planEditState.status !== 'idle'
  const planEditDate = planEditOpen ? planEditState.date : ''
  const planEditItem = planEditOpen ? planEditState.item : null
  const planEditError = planEditState.status === 'error' ? planEditState.message : null
  const planEditSubmitting = planEditState.status === 'submitting'

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-6 py-12">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          <Link to="/projects" className="text-xs text-primary hover:underline">
            Projects
          </Link>{' '}
          / {project.name}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-foreground">{project.name}</h1>
            <p className="text-sm text-muted-foreground">{project.siteUrl}</p>
          </div>
          <dl className="grid grid-cols-2 gap-4 text-xs text-muted-foreground sm:text-right">
            <div>
              <dt>Default locale</dt>
              <dd className="font-medium text-foreground">{project.defaultLocale}</dd>
            </div>
            <div>
              <dt>Auto publish</dt>
              <dd className="font-medium text-foreground">
                {(project.autoPublishPolicy ?? 'buffered').toUpperCase()}
              </dd>
            </div>
          </dl>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <StatCard
            label="Queue depth"
            value={snapshot?.queueDepth ?? 0}
            helper="Jobs queued or running for this project"
          />
          <StatCard
            label="Plan items"
            value={mergedPlanItems.length}
            helper="Titles + outlines scheduled over the next 30 days"
          />
          <StatCard
            label="Connected integrations"
            value={connectedIntegrations.length}
            helper="Ready for publishing"
          />
          <StatCard
            label="Last discovery"
            value={
              snapshot?.latestDiscovery?.startedAt
                ? formatDateTime(snapshot.latestDiscovery.startedAt)
                : '—'
            }
            helper={
              snapshot?.latestDiscovery
                ? snapshot.latestDiscovery.providersUsed.join(', ')
                : 'Pending'
            }
          />
        </div>
      </header>

      {notices.length > 0 ? (
        <section className="flex flex-col gap-2">
          {notices.map((notice) => (
            <div
              key={notice.id}
              className={`flex items-start justify-between gap-3 rounded-md border p-3 text-sm ${noticeKindClass(
                notice.kind
              )}`}
            >
              <p className="leading-snug">{notice.text}</p>
              <button
                type="button"
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
                onClick={() => dismissNotice(notice.id)}
              >
                Dismiss
              </button>
            </div>
          ))}
        </section>
      ) : null}

      <nav className="mt-2 flex flex-wrap gap-2 border-b border-border pb-2">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            to="/projects/$projectId"
            params={{ projectId }}
            search={{ tab: tab.key }}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              tab.key === activeTab
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {activeTab === 'overview' ? (
        <OverviewTab
          project={project}
          snapshot={snapshot}
          onStartCrawl={() => startCrawlMutation.mutate()}
          onGenerateKeywords={() => generateKeywordsMutation.mutate()}
          onCreatePlan={() => createPlanMutation.mutate()}
          onRunSchedule={() => runScheduleMutation.mutate()}
          isStartingCrawl={startCrawlMutation.isPending}
          isGeneratingKeywords={generateKeywordsMutation.isPending}
          isCreatingPlan={createPlanMutation.isPending}
          isRunningSchedule={runScheduleMutation.isPending}
        />
      ) : null}

      {activeTab === 'crawl' ? (
        <CrawlTab
          items={crawlPages}
          isLoading={crawlPagesQuery.isLoading}
          onRefresh={() => crawlPagesQuery.refetch()}
          onStartCrawl={() => startCrawlMutation.mutate()}
          isStarting={startCrawlMutation.isPending}
        />
      ) : null}

      {activeTab === 'keywords' ? (
        <KeywordsTab
          keywords={keywords}
          isLoading={keywordsQuery.isLoading}
          onRefresh={() => keywordsQuery.refetch()}
          onGenerate={() => generateKeywordsMutation.mutate()}
          isGenerating={generateKeywordsMutation.isPending}
        />
      ) : null}

      {activeTab === 'plan' ? (
        <PlanTab
          projectId={projectId}
          planItems={mergedPlanItems}
          articlesByPlanId={articlesByPlanId}
          planEditState={planEditState}
          onReschedule={openPlanEdit}
          onCreatePlan={() => createPlanMutation.mutate()}
          onRunSchedule={() => runScheduleMutation.mutate()}
          isCreatingPlan={createPlanMutation.isPending}
          isRunningSchedule={runScheduleMutation.isPending}
          queueDepth={snapshot?.queueDepth ?? 0}
        />
      ) : null}

      {activeTab === 'articles' ? (
        <ArticlesTab
          projectId={projectId}
          articles={articles}
          planItemMap={planItemMap}
          integrations={snapshot?.integrations ?? []}
          onPublish={(articleId, integrationId) =>
            publishArticleMutation.mutate({ articleId, integrationId })
          }
          publishState={publishState}
          onRefresh={() => articlesQuery.refetch()}
          isLoading={articlesQuery.isLoading}
        />
      ) : null}

      {activeTab === 'integrations' ? (
        <IntegrationsTab
          integrations={snapshot?.integrations ?? []}
          onTest={(integrationId) => testIntegrationMutation.mutate(integrationId)}
          testingIntegrationId={testingIntegrationId}
          onCreateWebhook={createWebhookMutation.mutateAsync}
          creatingWebhook={createWebhookMutation.isPending}
        />
      ) : null}

      {planEditOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-foreground">Reschedule plan item</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose a new publication date for <span className="font-medium">{planEditItem?.title}</span>.
            </p>
            {planEditError ? (
              <div className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {planEditError}
              </div>
            ) : null}
            <form
              className="mt-4 space-y-4"
              onSubmit={(event) => {
                event.preventDefault()
                if (!planEditItem || !planEditDate) return
                rescheduleMutation.mutate({
                  planItemId: planEditItem.id,
                  plannedDate: planEditDate
                })
              }}
            >
              <label className="flex flex-col gap-1 text-sm font-medium text-muted-foreground">
                Planned date
                <input
                  type="date"
                  value={planEditDate}
                  onChange={(event) => updatePlanEditDate(event.target.value)}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  disabled={planEditSubmitting}
                  required
                />
              </label>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="rounded-md border border-input px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted"
                  onClick={closePlanEdit}
                  disabled={planEditSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground shadow-sm disabled:opacity-60"
                  disabled={!planEditItem || !planEditDate || planEditSubmitting}
                >
                  {planEditSubmitting ? 'Updating…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  )
}

function OverviewTab({
  project,
  snapshot,
  onStartCrawl,
  onGenerateKeywords,
  onCreatePlan,
  onRunSchedule,
  isStartingCrawl,
  isGeneratingKeywords,
  isCreatingPlan,
  isRunningSchedule
}: {
  project: any
  snapshot: any
  onStartCrawl: () => void
  onGenerateKeywords: () => void
  onCreatePlan: () => void
  onRunSchedule: () => void
  isStartingCrawl: boolean
  isGeneratingKeywords: boolean
  isCreatingPlan: boolean
  isRunningSchedule: boolean
}) {
  const summary = snapshot?.latestDiscovery?.summaryJson ?? {}
  const topicClusters = Array.isArray(summary?.topicClusters) ? summary.topicClusters : []

  return (
    <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Automation controls</h2>
        <p className="text-sm text-muted-foreground">
          Kick off jobs and refresh the content pipeline for this project.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <ActionButton
            label="Start crawl"
            description="Fetch the latest snapshot of the site."
            onClick={onStartCrawl}
            disabled={isStartingCrawl}
            loading={isStartingCrawl}
          />
          <ActionButton
            label="Generate keywords"
            description="Run discovery (crawl ➝ summary ➝ metrics)."
            onClick={onGenerateKeywords}
            disabled={isGeneratingKeywords}
            loading={isGeneratingKeywords}
          />
          <ActionButton
            label="Build 30-day plan"
            description="Draft titles and outlines from the top keywords."
            onClick={onCreatePlan}
            disabled={isCreatingPlan}
            loading={isCreatingPlan}
          />
          <ActionButton
            label="Run schedule now"
            description="Generate today’s drafts and auto-publish if eligible."
            onClick={onRunSchedule}
            disabled={isRunningSchedule}
            loading={isRunningSchedule}
          />
        </div>
      </div>

      <aside className="rounded-lg border bg-card p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-foreground">Latest discovery</h3>
        {snapshot?.latestDiscovery ? (
          <dl className="mt-3 space-y-2 text-xs text-muted-foreground">
            <div>
              <dt>Started</dt>
              <dd className="font-medium text-foreground">
                {formatDateTime(snapshot.latestDiscovery.startedAt)}
              </dd>
            </div>
            <div>
              <dt>Providers</dt>
              <dd className="font-medium text-foreground">
                {snapshot.latestDiscovery.providersUsed.join(', ')}
              </dd>
            </div>
            {topicClusters.length > 0 ? (
              <div>
                <dt>Topic clusters</dt>
                <dd className="mt-1 flex flex-wrap gap-1">
                  {topicClusters.map((cluster: string) => (
                    <span
                      key={cluster}
                      className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground"
                    >
                      {cluster}
                    </span>
                  ))}
                </dd>
              </div>
            ) : null}
            {summary?.businessSummary ? (
              <div>
                <dt>Business summary</dt>
                <dd className="mt-1 text-xs leading-snug text-foreground">
                  {summary.businessSummary}
                </dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            No discovery run yet. Start the keyword generation workflow to populate this summary.
          </p>
        )}
      </aside>
    </section>
  )
}

function CrawlTab({
  items,
  isLoading,
  onRefresh,
  onStartCrawl,
  isStarting
}: {
  items: any[]
  isLoading: boolean
  onRefresh: () => void
  onStartCrawl: () => void
  isStarting: boolean
}) {
  const lastExtractedAt = items[0]?.extractedAt ?? null

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onStartCrawl}
          disabled={isStarting}
        >
          {isStarting ? 'Starting…' : 'Start crawl'}
        </button>
        <button
          type="button"
          className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onRefresh}
          disabled={isLoading}
        >
          {isLoading ? 'Refreshing…' : 'Refresh list'}
        </button>
        {lastExtractedAt ? (
          <span className="text-xs text-muted-foreground">
            Last fetched {formatDateTime(lastExtractedAt)}
          </span>
        ) : null}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading crawl pages…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No crawl pages yet. Start a crawl to populate the site snapshot.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">URL</th>
                <th className="px-4 py-2 text-left font-semibold">Status</th>
                <th className="px-4 py-2 text-left font-semibold">Title</th>
                <th className="px-4 py-2 text-left font-semibold">Extracted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((page) => (
                <tr key={page.id} className="odd:bg-muted/30">
                  <td className="break-all px-4 py-3 text-sm font-medium text-primary">
                    {page.url}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {page.httpStatus ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {page.metaJson?.title ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {formatDateTime(page.extractedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function KeywordsTab({
  keywords,
  isLoading,
  onRefresh,
  onGenerate,
  isGenerating
}: {
  keywords: any[]
  isLoading: boolean
  onRefresh: () => void
  onGenerate: () => void
  isGenerating: boolean
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? 'Generating…' : 'Generate keywords'}
        </button>
        <button
          type="button"
          className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onRefresh}
          disabled={isLoading}
        >
          {isLoading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading keywords…</p>
      ) : keywords.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No keywords yet. Trigger the discovery workflow to populate this list.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">Keyword</th>
                <th className="px-4 py-2 text-left font-semibold">Opportunity</th>
                <th className="px-4 py-2 text-left font-semibold">Difficulty</th>
                <th className="px-4 py-2 text-left font-semibold">Volume</th>
                <th className="px-4 py-2 text-left font-semibold">CPC</th>
                <th className="px-4 py-2 text-left font-semibold">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {keywords.map((keyword) => {
                const badge = computeOpportunityBadge(keyword)
                const metrics = keyword.metricsJson ?? {}
                return (
                  <tr key={keyword.id} className="odd:bg-muted/30">
                    <td className="px-4 py-3 text-sm font-medium text-foreground">{keyword.phrase}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${badgeClassForTone(
                          badge.tone
                        )}`}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {metrics?.difficulty ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatNumber(metrics?.searchVolume)}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatCurrency(metrics?.cpc)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDateTime(metrics?.asOf)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function PlanTab({
  projectId,
  planItems,
  articlesByPlanId,
  planEditState,
  onReschedule,
  onCreatePlan,
  onRunSchedule,
  isCreatingPlan,
  isRunningSchedule,
  queueDepth
}: {
  projectId: string
  planItems: any[]
  articlesByPlanId: Map<string, any>
  planEditState: PlanEditState
  onReschedule: (planItem: any) => void
  onCreatePlan: () => void
  onRunSchedule: () => void
  isCreatingPlan: boolean
  isRunningSchedule: boolean
  queueDepth: number
}) {
  const calendarCells = useMemo(() => buildCalendarCells(planItems), [planItems])
  const monthHeading = planItems.length > 0 ? formatMonthTitle(planItems[0].plannedDate) : null

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onCreatePlan}
          disabled={isCreatingPlan}
        >
          {isCreatingPlan ? 'Rebuilding…' : 'Regenerate plan'}
        </button>
        <button
          type="button"
          className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onRunSchedule}
          disabled={isRunningSchedule}
        >
          {isRunningSchedule ? 'Running…' : 'Run schedule now'}
        </button>
        <span className="text-xs text-muted-foreground">Queue depth: {queueDepth}</span>
      </div>

      {planItems.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No plan items yet. Generate keywords and run the plan builder to populate the calendar.
        </p>
      ) : (
        <div className="space-y-3">
          {monthHeading ? (
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {monthHeading}
            </h3>
          ) : null}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-7">
            {calendarCells.map((cell) => (
              <div
                key={cell.iso}
                className={`rounded-md border p-3 text-xs ${
                  cell.withinRange ? 'bg-card text-foreground' : 'bg-muted/30 text-muted-foreground'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wide">
                  <span>{formatCalendarDay(cell.date)}</span>
                  <span>{cell.iso}</span>
                </div>
                <div className="mt-3 space-y-2">
                  {cell.items.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">No assignments</p>
                  ) : (
                    cell.items.map((item) => {
                      const status = resolvePlanStatus(item, articlesByPlanId)
                      const relatedArticle = articlesByPlanId.get(item.id)
                      const isActive = planEditState.status !== 'idle' && planEditState.item?.id === item.id
                      const isSubmitting = planEditState.status === 'submitting' && planEditState.item?.id === item.id
                      const isErrored = planEditState.status === 'error' && planEditState.item?.id === item.id
                      const errorMessage = isErrored ? planEditState.message : null
                      return (
                        <div
                          key={item.id}
                          className={`space-y-2 rounded-md border border-dashed border-border/60 bg-background/80 p-2 shadow-sm ${
                            isActive ? 'ring-1 ring-primary/60' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[11px] font-semibold leading-snug text-foreground">
                              {item.title}
                            </p>
                            <span
                              className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase ${badgeClassForTone(
                                status.tone
                              )}`}
                            >
                              {status.label}
                            </span>
                          </div>
                          <div className="flex flex-col gap-1">
                            <div className="flex flex-wrap items-center gap-2 text-[11px]">
                              <button
                                type="button"
                                className={`font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-60`}
                                onClick={() => onReschedule(item)}
                                disabled={isSubmitting}
                              >
                                {isSubmitting ? 'Saving…' : 'Reschedule'}
                              </button>
                              {relatedArticle ? (
                                <Link
                                  to="/projects/$projectId/articles/$articleId"
                                  params={{ projectId, articleId: relatedArticle.id }}
                                  className="font-medium text-primary hover:underline"
                                >
                                  View draft
                                </Link>
                              ) : null}
                            </div>
                            {errorMessage ? (
                              <p className="text-[10px] font-medium text-destructive">{errorMessage}</p>
                            ) : null}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function ArticlesTab({
  projectId,
  articles,
  planItemMap,
  integrations,
  onPublish,
  publishState,
  onRefresh,
  isLoading
}: {
  projectId: string
  articles: any[]
  planItemMap: Map<string, any>
  integrations: any[]
  onPublish: (articleId: string, integrationId: string) => void
  publishState: PublishState
  onRefresh: () => void
  isLoading: boolean
}) {
  const [selections, setSelections] = useState<Record<string, string>>({})

  const connected = integrations.filter((integration) => integration.status === 'connected')

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onRefresh}
          disabled={isLoading}
        >
          {isLoading ? 'Refreshing…' : 'Refresh'}
        </button>
        {connected.length === 0 ? (
          <span className="text-xs text-muted-foreground">
            Connect a webhook or CMS integration to publish drafts.
          </span>
        ) : null}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading articles…</p>
      ) : articles.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No drafts yet. Run the daily schedule to generate a draft for today’s plan item.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">Title</th>
                <th className="px-4 py-2 text-left font-semibold">Planned date</th>
                <th className="px-4 py-2 text-left font-semibold">Status</th>
                <th className="px-4 py-2 text-left font-semibold">Generated</th>
                <th className="px-4 py-2 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {articles.map((article) => {
                const planItem = planItemMap.get(article.planItemId ?? '')
                const chosenIntegration =
                  selections[article.id] ?? connected[0]?.id ?? ''
                const statusTone =
                  article.status === 'published'
                    ? 'emerald'
                    : article.status === 'draft'
                      ? 'amber'
                      : 'rose'
                const publishSubmitting =
                  publishState.status === 'submitting' && publishState.articleId === article.id
                const publishQueued =
                  publishState.status === 'queued' && publishState.articleId === article.id
                const publishError =
                  publishState.status === 'error' && publishState.articleId === article.id
                    ? publishState.message
                    : null

                return (
                  <tr key={article.id} className="odd:bg-muted/30">
                    <td className="px-4 py-3 text-sm font-medium text-foreground">
                      {article.title}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {planItem ? planItem.plannedDate : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${badgeClassForTone(
                          statusTone
                        )}`}
                      >
                        {article.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDateTime(article.generationDate ?? article.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to="/projects/$projectId/articles/$articleId"
                          params={{ projectId, articleId: article.id }}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          Edit
                        </Link>
                        <select
                          className="rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                          value={chosenIntegration}
                          onChange={(event) =>
                            setSelections((prev) => ({
                              ...prev,
                              [article.id]: event.target.value
                            }))
                          }
                          disabled={connected.length === 0}
                        >
                          <option value="">Select integration</option>
                          {connected.map((integration) => (
                            <option key={integration.id} value={integration.id}>
                              {integration.type} · {formatIntegrationLabel(integration)}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={() => {
                            if (!chosenIntegration || publishSubmitting) return
                            onPublish(article.id, chosenIntegration)
                          }}
                          disabled={!chosenIntegration || publishSubmitting || connected.length === 0}
                        >
                          {publishSubmitting ? 'Publishing…' : publishQueued ? 'Queued' : 'Publish'}
                        </button>
                        {publishQueued && publishState.jobId ? (
                          <span className="text-[10px] text-muted-foreground">
                            Job {publishState.jobId} queued
                          </span>
                        ) : null}
                        {publishError ? (
                          <span className="text-[10px] font-medium text-destructive">{publishError}</span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function IntegrationsTab({
  integrations,
  onTest,
  testingIntegrationId,
  onCreateWebhook,
  creatingWebhook
}: {
  integrations: any[]
  onTest: (integrationId: string) => void
  testingIntegrationId: string | null
  onCreateWebhook: (input: { targetUrl: string; secret: string }) => Promise<unknown>
  creatingWebhook: boolean
}) {
  const [targetUrl, setTargetUrl] = useState('')
  const [secret, setSecret] = useState('')

  return (
    <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
      <div className="space-y-4">
        {integrations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No integrations yet. Add a webhook to start publishing drafts.
          </p>
        ) : (
          integrations.map((integration) => (
            <article key={integration.id} className="rounded-lg border bg-card p-4 shadow-sm">
              <header className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {formatIntegrationLabel(integration)}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {integration.type.toUpperCase()} · {integration.status.toUpperCase()}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-md border border-input px-3 py-1 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => onTest(integration.id)}
                  disabled={testingIntegrationId === integration.id}
                >
                  {testingIntegrationId === integration.id ? 'Testing…' : 'Send test'}
                </button>
              </header>
              {integration.type === 'webhook' ? (
                <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
                  <div>
                    <dt>Target URL</dt>
                    <dd className="break-all text-foreground">
                      {integration.configJson?.targetUrl ?? '—'}
                    </dd>
                  </div>
                  <div>
                    <dt>Secret</dt>
                    <dd>{integration.configJson?.secret ? maskSecret(integration.configJson.secret) : '—'}</dd>
                  </div>
                </dl>
              ) : null}
            </article>
          ))
        )}
      </div>

      <aside className="rounded-lg border bg-card p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-foreground">Add webhook</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Configure a webhook receiver to publish PortableArticle payloads with HMAC signatures.
        </p>
        <form
          className="mt-4 space-y-3 text-sm"
          onSubmit={async (event) => {
            event.preventDefault()
            if (!targetUrl || !secret) return
            try {
              await onCreateWebhook({ targetUrl, secret })
              setTargetUrl('')
              setSecret('')
            } catch {
              // errors surface via notices
            }
          }}
        >
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Target URL
            <input
              type="url"
              required
              value={targetUrl}
              onChange={(event) => setTargetUrl(event.target.value)}
              placeholder="https://example.com/seo-agent"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              disabled={creatingWebhook}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Secret
            <input
              type="text"
              required
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
              placeholder="Shared secret"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              disabled={creatingWebhook}
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!targetUrl || !secret || creatingWebhook}
          >
            {creatingWebhook ? 'Creating…' : 'Create webhook'}
          </button>
        </form>
      </aside>
    </section>
  )
}

function ActionButton({
  label,
  description,
  onClick,
  disabled,
  loading
}: {
  label: string
  description: string
  onClick: () => void
  disabled: boolean
  loading: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-start gap-2 rounded-lg border border-input bg-background px-4 py-3 text-left shadow-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="text-sm font-semibold text-foreground">
        {loading ? `${label}…` : label}
      </span>
      <span className="text-xs text-muted-foreground">{description}</span>
    </button>
  )
}

function StatCard({
  label,
  value,
  helper
}: {
  label: string
  value: string | number
  helper?: string
}) {
  return (
    <article className="rounded-lg border bg-card p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
      {helper ? <p className="mt-1 text-xs text-muted-foreground">{helper}</p> : null}
    </article>
  )
}

function noticeKindClass(kind: 'success' | 'error' | 'info') {
  switch (kind) {
    case 'success':
      return 'border-emerald-400 bg-emerald-50 text-emerald-800'
    case 'error':
      return 'border-destructive bg-destructive/10 text-destructive'
    default:
      return 'border-primary/40 bg-primary/10 text-primary'
  }
}

async function fetchJson(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, {
    credentials: 'include',
    ...init
  })

  if (!response.ok) {
    let message = `Request failed with ${response.status}`
    try {
      const data = await response.clone().json()
      if (typeof data?.message === 'string') {
        message = data.message
      } else if (typeof data?.error === 'string') {
        message = data.error
      } else {
        message = JSON.stringify(data)
      }
    } catch {
      try {
        const text = await response.text()
        if (text) {
          message = text
        }
      } catch {
        // ignore
      }
    }
    throw new Error(message)
  }

  if (response.status === 204) {
    return null
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    return response.json()
  }

  return response.text()
}

const postJson = (path: string, body: unknown) =>
  fetchJson(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {})
  })

const patchJson = (path: string, body: unknown) =>
  fetchJson(path, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {})
  })

function extractErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message || 'Request failed'
  }
  if (typeof error === 'string') {
    return error
  }
  try {
    return JSON.stringify(error)
  } catch {
    return 'Unknown error'
  }
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

function formatNumber(value: unknown) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat().format(value)
}

function formatCurrency(value: unknown) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—'
  return `$${value.toFixed(2)}`
}

function computeOpportunityBadge(keyword: any) {
  const metrics = keyword.metricsJson ?? {}
  const volume = typeof metrics?.searchVolume === 'number' ? metrics.searchVolume : 0
  const difficulty = typeof metrics?.difficulty === 'number' ? metrics.difficulty : 50

  if (!volume) {
    return { label: 'Unknown', tone: 'slate' as const }
  }

  const score = volume - difficulty * 4

  if (score >= 400) {
    return { label: 'High', tone: 'emerald' as const }
  }
  if (score >= 200) {
    return { label: 'Medium', tone: 'amber' as const }
  }
  return { label: 'Low', tone: 'blue' as const }
}

function resolvePlanStatus(planItem: any, articlesByPlanId: Map<string, any>) {
  const article = articlesByPlanId.get(planItem.id)
  if (article?.status === 'published') {
    return { label: 'PUBLISHED', tone: 'emerald' as const }
  }
  if (article?.status === 'draft') {
    return { label: 'DRAFT GENERATED', tone: 'amber' as const }
  }
  if (planItem.status === 'skipped') {
    return { label: 'SKIPPED', tone: 'rose' as const }
  }
  return { label: 'PLANNED', tone: 'blue' as const }
}

function badgeClassForTone(tone: string) {
  switch (tone) {
    case 'emerald':
      return 'bg-emerald-100 text-emerald-800'
    case 'amber':
      return 'bg-amber-100 text-amber-800'
    case 'rose':
      return 'bg-rose-100 text-rose-800'
    case 'blue':
      return 'bg-blue-100 text-blue-800'
    default:
      return 'bg-muted text-foreground'
  }
}

function parseIsoDate(value: string) {
  const parts = value?.split('-') ?? []
  if (parts.length !== 3) return null
  const [year, month, day] = parts.map((part) => Number.parseInt(part, 10))
  if ([year, month, day].some((part) => Number.isNaN(part))) return null
  return new Date(Date.UTC(year, month - 1, day))
}

function startOfWeek(date: Date) {
  const result = new Date(date)
  const weekday = (result.getUTCDay() + 6) % 7
  result.setUTCDate(result.getUTCDate() - weekday)
  return result
}

function endOfWeek(date: Date) {
  const result = new Date(date)
  const weekday = (result.getUTCDay() + 6) % 7
  result.setUTCDate(result.getUTCDate() + (6 - weekday))
  return result
}

function buildCalendarCells(planItems: any[]) {
  if (!planItems?.length) return []
  const sorted = [...planItems].sort((a, b) => a.plannedDate.localeCompare(b.plannedDate))
  const firstDate = parseIsoDate(sorted[0].plannedDate)
  const lastDate = parseIsoDate(sorted[sorted.length - 1].plannedDate)
  if (!firstDate || !lastDate) return []
  const start = startOfWeek(firstDate)
  const end = endOfWeek(lastDate)
  const millisPerDay = 24 * 60 * 60 * 1000
  const cells: Array<{ iso: string; date: Date; items: any[]; withinRange: boolean }> = []
  for (let time = start.getTime(); time <= end.getTime(); time += millisPerDay) {
    const current = new Date(time)
    const iso = current.toISOString().slice(0, 10)
    const itemsForDay = sorted.filter((item) => item.plannedDate === iso)
    cells.push({
      iso,
      date: current,
      items: itemsForDay,
      withinRange: time >= firstDate.getTime() && time <= lastDate.getTime()
    })
  }
  return cells
}

function formatCalendarDay(date: Date) {
  return date.toLocaleDateString(undefined, {
    weekday: 'short'
  })
}

function formatMonthTitle(isoDate: string) {
  const date = parseIsoDate(isoDate)
  if (!date) return null
  return date.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric'
  })
}

function formatIntegrationLabel(integration: any) {
  if (integration.type === 'webhook') {
    const targetUrl = integration.configJson?.targetUrl
    if (typeof targetUrl === 'string') {
      try {
        const url = new URL(targetUrl)
        return url.host
      } catch {
        return targetUrl
      }
    }
    return 'Webhook'
  }
  return integration.type
}

function maskSecret(value: string) {
  if (!value) return ''
  if (value.length <= 6) {
    return '*'.repeat(value.length)
  }
  return `${value.slice(0, 3)}…${value.slice(-3)}`
}
