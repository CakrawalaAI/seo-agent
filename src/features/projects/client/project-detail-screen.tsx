import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
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
} from '@features/plan/shared/state-machines'

import { OverviewTab } from '@features/projects/client/overview-tab'
import { CrawlTab } from '@features/crawl/client/crawl-tab'
import { KeywordsTab } from '@features/keywords/client/keywords-tab'
import { PlanTab } from '@features/plan/client/plan-tab'
import { ArticlesTab } from '@features/articles/client/articles-tab'
import { IntegrationsTab } from '@features/integrations/client/integrations-tab'
import { ProjectJobsTab } from '@features/projects/client/jobs-tab'
import {
  extractErrorMessage,
  formatDateTime,
  noticeKindClass
} from '@features/projects/shared/helpers'
import {
  createPlan,
  createWebhook,
  generateKeywords,
  getCrawlPages,
  getPlanItems,
  getProject,
  getProjectArticles,
  getProjectKeywords,
  getProjectSnapshot,
  publishArticle as publishArticleApi,
  reschedulePlanItem,
  runCrawl,
  runSchedule,
  testIntegration
} from '@entities/project/service'
import { patchKeyword } from '@entities/keyword/service'
import { listJobs } from '@entities/job/service'
import type {
  Article,
  CrawlPage,
  Job,
  Keyword,
  PlanItem,
  Project,
  ProjectIntegration,
  ProjectSnapshot
} from '@entities'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'crawl', label: 'Crawl' },
  { key: 'keywords', label: 'Keywords' },
  { key: 'plan', label: 'Calendar' },
  { key: 'articles', label: 'Articles' },
  { key: 'jobs', label: 'Jobs' },
  { key: 'integrations', label: 'Integrations' }
] as const

type ProjectDetailScreenProps = {
  projectId: string
  tab?: string | null
}

const DEFAULT_TAB = 'overview'

type Notice = {
  id: string
  kind: 'success' | 'error' | 'info'
  text: string
}

export function ProjectDetailScreen({ projectId, tab }: ProjectDetailScreenProps) {
  const queryClient = useQueryClient()

  const [notices, setNotices] = useState<Notice[]>([])
  const [planEditState, setPlanEditState] = useState<PlanEditState>(() => createIdlePlanEditState())
  const [testingIntegrationId, setTestingIntegrationId] = useState<string | null>(null)
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
    const requested = typeof tab === 'string' ? tab : ''
    return TABS.some((tab) => tab.key === requested) ? requested : DEFAULT_TAB
  }, [tab])

  const pushNotice = (kind: Notice['kind'], text: string) => {
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

  const openPlanEdit = (item: PlanItem | null) => {
    if (!item) return
    setPlanEditState(openPlanEditor(item))
  }

  const updatePlanEditDate = (value: string) => {
    setPlanEditState((prev) => updatePlanEditorDate(prev, value))
  }

  const closePlanEdit = () => {
    setPlanEditState((prev) => closePlanEditor(prev))
  }

  const projectQuery = useQuery<Project>({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
    staleTime: 60_000
  })

  const snapshotQuery = useQuery<ProjectSnapshot>({
    queryKey: ['projectSnapshot', projectId],
    queryFn: () => getProjectSnapshot(projectId),
    staleTime: 30_000
  })

  const project = projectQuery.data ?? null
  const snapshot = snapshotQuery.data ?? null

  const connectedIntegrations = useMemo(
    () => (snapshot?.integrations ?? ([] as ProjectIntegration[])).filter((integration) => integration.status === 'connected'),
    [snapshot?.integrations]
  )

  const startCrawlMutation = useMutation({
    mutationFn: () => runCrawl(projectId),
    onSuccess: (result) => {
      pushNotice('success', `Crawl job ${result?.jobId ?? 'enqueued'}`)
      queryClient.invalidateQueries({ queryKey: ['projectSnapshot', projectId] })
      queryClient.invalidateQueries({ queryKey: ['crawlPages', projectId] })
      queryClient.invalidateQueries({ queryKey: ['jobs', projectId] })
    },
    onError: (error) => pushNotice('error', extractErrorMessage(error))
  })

  const generateKeywordsMutation = useMutation({
    mutationFn: () => generateKeywords(projectId, project?.defaultLocale ?? 'en-US'),
    onSuccess: (result) => {
      pushNotice('success', `Discovery job ${result?.jobId ?? 'enqueued'}`)
      queryClient.invalidateQueries({ queryKey: ['keywords', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projectSnapshot', projectId] })
      queryClient.invalidateQueries({ queryKey: ['jobs', projectId] })
    },
    onError: (error) => pushNotice('error', extractErrorMessage(error))
  })

  const createPlanMutation = useMutation({
    mutationFn: () => createPlan(projectId, 30),
    onSuccess: (result) => {
      pushNotice('success', `Plan job ${result?.jobId ?? 'enqueued'}`)
      queryClient.invalidateQueries({ queryKey: ['plan', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projectSnapshot', projectId] })
      queryClient.invalidateQueries({ queryKey: ['jobs', projectId] })
    },
    onError: (error) => pushNotice('error', extractErrorMessage(error))
  })

  const runScheduleMutation = useMutation({
    mutationFn: () => runSchedule(projectId),
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
      queryClient.invalidateQueries({ queryKey: ['jobs', projectId] })
    },
    onError: (error) => pushNotice('error', extractErrorMessage(error))
  })

  const rescheduleMutation = useMutation({
    mutationFn: ({ planItemId, plannedDate }: { planItemId: string; plannedDate: string }) =>
      reschedulePlanItem(planItemId, plannedDate),
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

  const crawlPagesQuery = useQuery<{ items: CrawlPage[] }>({
    queryKey: ['crawlPages', projectId],
    queryFn: () => getCrawlPages(projectId),
    enabled: activeTab === 'crawl'
  })

  const keywordsQuery = useQuery<{ items: Keyword[] }>({
    queryKey: ['keywords', projectId],
    queryFn: () => getProjectKeywords(projectId),
    enabled: activeTab === 'keywords'
  })

  const planQuery = useQuery<{ items: PlanItem[] }>({
    queryKey: ['plan', projectId],
    queryFn: () => getPlanItems(projectId),
    enabled: activeTab === 'plan'
  })

  const articlesQuery = useQuery<{ items: Article[] }>({
    queryKey: ['articles', projectId],
    queryFn: () => getProjectArticles(projectId),
    enabled: activeTab === 'articles' || activeTab === 'plan'
  })

  const jobsQuery = useQuery<{ items: Job[] }>({
    queryKey: ['jobs', projectId],
    queryFn: () => listJobs(projectId, 25),
    enabled: activeTab === 'overview' || activeTab === 'jobs'
  })

  const publishArticleMutation = useMutation({
    mutationFn: ({ articleId, integrationId }: { articleId: string; integrationId: string }) =>
      publishArticleApi(articleId, integrationId),
    onMutate: ({ articleId, integrationId }) => {
      clearPublishReset()
      setPublishState((prev) => publishSubmitting(prev, { articleId, integrationId }))
    },
    onSuccess: (result, variables) => {
      pushNotice('success', `Publish job ${result?.jobId ?? 'queued'}`)
      queryClient.invalidateQueries({ queryKey: ['articles', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projectSnapshot', projectId] })
      queryClient.invalidateQueries({ queryKey: ['jobs', projectId] })
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
    mutationFn: (integrationId: string) => testIntegration(integrationId),
    onMutate: (integrationId) => {
      setTestingIntegrationId(integrationId)
    },
    onSuccess: () => {
      pushNotice('success', 'Integration test event delivered')
      queryClient.invalidateQueries({ queryKey: ['projectSnapshot', projectId] })
      queryClient.invalidateQueries({ queryKey: ['jobs', projectId] })
    },
    onError: (error) => pushNotice('error', extractErrorMessage(error)),
    onSettled: () => setTestingIntegrationId(null)
  })

  const createWebhookMutation = useMutation({
    mutationFn: ({ targetUrl, secret }: { targetUrl: string; secret: string }) =>
      createWebhook(projectId, targetUrl, secret),
    onSuccess: () => {
      pushNotice('success', 'Webhook integration created')
      queryClient.invalidateQueries({ queryKey: ['projectSnapshot', projectId] })
    },
    onError: (error) => pushNotice('error', extractErrorMessage(error))
  })

  const planKeywordMutation = useMutation({
    mutationFn: (keywordId: string) => patchKeyword(keywordId, { status: 'planned' }),
    onSuccess: () => {
      pushNotice('success', 'Keyword planned')
      queryClient.invalidateQueries({ queryKey: ['keywords', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projectSnapshot', projectId] })
    },
    onError: (error) => pushNotice('error', extractErrorMessage(error))
  })

  const toggleStarKeywordMutation = useMutation({
    mutationFn: (input: { keywordId: string; starred: boolean }) =>
      patchKeyword(input.keywordId, { starred: input.starred }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keywords', projectId] })
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
    const map = new Map<string, Article>()
    for (const article of articles) {
      if (article.planItemId) {
        map.set(article.planItemId, article)
      }
    }
    return map
  }, [articles])

  const planItemMap = useMemo(() => {
    const map = new Map<string, PlanItem>()
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
          snapshot={snapshot}
          jobs={jobsQuery.data?.items ?? []}
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
          onPlan={(keywordId) => planKeywordMutation.mutate(keywordId)}
          onToggleStar={(keywordId, starred) =>
            toggleStarKeywordMutation.mutate({ keywordId, starred })
          }
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

      {activeTab === 'jobs' ? (
        <ProjectJobsTab
          jobs={jobsQuery.data?.items ?? []}
          isLoading={jobsQuery.isLoading}
          onRefresh={() => jobsQuery.refetch()}
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

type StatCardProps = {
  label: string
  value: string | number
  helper?: string
}

function StatCard({ label, value, helper }: StatCardProps) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
      {helper ? <p className="mt-1 text-xs text-muted-foreground">{helper}</p> : null}
    </div>
  )
}
