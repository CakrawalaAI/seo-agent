import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useActiveWebsite } from '@common/state/active-website'
import { useMockData } from '@common/dev/mock-data-context'
import { getWebsite, getWebsiteSnapshot, runSchedule } from '@entities/website/service'
import { extractErrorMessage } from '@common/http/json'
import type { Keyword } from '@entities'
import type { PlanItem } from '@entities/article/planner'
import { Button } from '@src/common/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@src/common/ui/empty'
import { Textarea } from '@src/common/ui/textarea'
import { OnboardingForm } from '@features/onboarding/client/onboarding-form'
import { Progress } from '@src/common/ui/progress'
import { useDashboardEvents } from '@features/dashboard/shared/use-dashboard-events'

type DashboardData = { website: any | null; snapshot: any | null }

const MOCK_PLAN_ITEMS: PlanItem[] = [
  {
    id: 'plan-1',
    websiteId: 'proj_mock',
    keywordId: null,
    title: 'Create 30-60-90 Day Plan Template',
    scheduledDate: new Date().toISOString(),
    status: 'scheduled'
  },
  {
    id: 'plan-2',
    websiteId: 'proj_mock',
    keywordId: null,
    title: 'Behavioral STAR Method Examples',
    scheduledDate: new Date(Date.now() + 86_400_000).toISOString(),
    status: 'draft'
  }
]

const MOCK_KEYWORDS: Keyword[] = [
  {
    id: 'kw-1',
    websiteId: 'proj_mock',
    canonId: 'kw-1',
    phrase: 'interview practice questions',
    metricsJson: { searchVolume: 5400, difficulty: 38, asOf: new Date().toISOString() }
  },
  {
    id: 'kw-2',
    websiteId: 'proj_mock',
    canonId: 'kw-2',
    phrase: 'mock interview ai',
    metricsJson: { searchVolume: 2600, difficulty: 42, asOf: new Date().toISOString() }
  }
]

const MOCK_DASHBOARD: DashboardData = {
  website: {
    id: 'proj_mock',
    orgId: 'org_mock',
    url: 'https://prepinterview.ai',
    defaultLocale: 'en-US',
    status: 'articles_scheduled',
    summary: [
      'Interview prep platform helping candidates practice behavioral questions with AI-guided drills.',
      'Key value props: real interview simulation, instant scoring, targeted feedback for tech roles.'
    ].join('\n')
  },
  snapshot: {
    queueDepth: 2,
    planItems: MOCK_PLAN_ITEMS,
    keywords: MOCK_KEYWORDS,
    crawlProgress: {
      jobId: 'crawl_mock',
      startedAt: new Date(Date.now() - 3_600_000).toISOString(),
      completedAt: null,
      crawledCount: 24,
      targetCount: 50
    },
    keywordProgress: {
      total: MOCK_KEYWORDS.length,
      latestCreatedAt: MOCK_KEYWORDS[0]?.metricsJson?.asOf ?? new Date().toISOString()
    },
    crawlStatus: 'idle',
    crawlCooldownExpiresAt: null,
    lastCrawlAt: new Date(Date.now() - 3_600_000 * 6).toISOString(),
    articleProgress: {
      generatedCount: MOCK_PLAN_ITEMS.length,
      scheduledCount: MOCK_PLAN_ITEMS.filter((item) => item.status === 'scheduled').length,
      targetCount: 30
    },
    latestKeywordGeneration: {
      startedAt: new Date(Date.now() - 3600_000 * 6).toISOString(),
      completedAt: new Date(Date.now() - 3600_000 * 2).toISOString(),
      providersUsed: ['crawl', 'keywordIdeas'],
      seedCount: 42,
      keywordCount: 215
    }
  }
}

export function Page(): JSX.Element {
  const { id: projectId } = useActiveWebsite()
  const { enabled: mockEnabled } = useMockData()

  const projectQuery = useQuery({
    queryKey: ['dashboard.website', projectId],
    queryFn: () => getWebsite(projectId!),
    enabled: Boolean(projectId && !mockEnabled)
  })

  const snapshotQuery = useQuery({
    queryKey: ['dashboard.snapshot', projectId],
    queryFn: () => getWebsiteSnapshot(projectId!),
    enabled: Boolean(projectId && !mockEnabled),
    refetchInterval: 30_000
  })

  const project = mockEnabled ? MOCK_DASHBOARD.website : projectQuery.data
  const snapshot = mockEnabled ? MOCK_DASHBOARD.snapshot : snapshotQuery.data
  const billingState = (snapshot?.billingState ?? null) as any
  const trialInfo = (billingState?.trial ?? null) as any
  const trialStatus = typeof billingState?.status === 'string' ? String(billingState.status).toLowerCase() : null
  const trialOutlinesThrough = typeof trialInfo?.outlinesThrough === 'string' ? trialInfo.outlinesThrough : null
  const trialEndsAt = typeof billingState?.trialEndsAt === 'string' ? billingState.trialEndsAt : null
  const activeUntil = typeof billingState?.activeUntil === 'string' ? billingState.activeUntil : null
  const complimentaryLimit = Number(trialInfo?.complimentaryLimit ?? 0)
  const complimentaryUsed = Number(trialInfo?.complimentaryUsed ?? 0)
  const complimentaryRemaining = Math.max(0, complimentaryLimit - complimentaryUsed)
  const fullyGeneratedCount = Number(snapshot?.articleProgress?.fullyGeneratedCount ?? 0)
  const showTrialBanner = !mockEnabled && trialStatus === 'trialing' && Boolean(trialOutlinesThrough)
  const showActiveBanner = !mockEnabled && !showTrialBanner && trialStatus === 'active'
  const showComplimentaryBanner =
    !mockEnabled && !showTrialBanner && !showActiveBanner && complimentaryRemaining > 0 && Boolean(trialOutlinesThrough)

  const insight = useMemo(() => buildInsights(project, snapshot), [project, snapshot])

  useDashboardEvents(projectId, { enabled: Boolean(projectId && !mockEnabled) })

  const [billingMessage, setBillingMessage] = useState<string | null>(null)
  const [isEditingSummary, setIsEditingSummary] = useState(false)
  const [draftSummary, setDraftSummary] = useState(() => project?.summary ?? insight.summaryText)
  const [reCrawlMessage, setReCrawlMessage] = useState<string | null>(null)
  const [reCrawlNextEligibleAt, setReCrawlNextEligibleAt] = useState<string | null>(null)

  useEffect(() => {
    if (mockEnabled) return
    if (isEditingSummary) return
    setDraftSummary((project?.summary ?? insight.summaryText).trim())
  }, [isEditingSummary, project?.summary, insight.summaryText, mockEnabled])

  const saveSummaryMutation = useMutation({
    mutationFn: async (_summary: string) => null,
    onSuccess: () => { setIsEditingSummary(false) }
  })

  const subscribeMutation = useMutation({
    mutationFn: async () => {
      if (mockEnabled) return
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
        redirect: 'manual'
      })
      if (res.status === 302) {
        const location = res.headers.get('Location')
        if (location && typeof window !== 'undefined') window.location.href = location
        return
      }
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { message?: string }
        throw new Error(payload?.message || `Checkout failed (${res.status})`)
      }
      const location = res.headers.get('Location')
      if (location && typeof window !== 'undefined') {
        window.location.href = location
        return
      }
      if (typeof window !== 'undefined') {
        window.location.href = '/api/billing/checkout'
      }
    },
    onMutate: () => {
      setBillingMessage(null)
    },
    onError: (error) => {
      setBillingMessage(extractErrorMessage(error))
    }
  })

const mergeActionMutation = useMutation({
    mutationFn: async (step: ProjectStatusStep['action']) => {
      if (!step || mockEnabled) return
      if (step.type === 'crawl') return projectId ? getWebsiteSnapshot(projectId) : null
      if (step.type === 'generateKeywords') return getWebsiteSnapshot(projectId!)
      if (step.type === 'schedulePlan') {
        // Create/refresh the 30-day plan runway
        await fetch('/api/plan-items', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ websiteId: projectId, days: 30 })
        })
        // Then kick the scheduler to fill 3-day buffer + publish due
        return runSchedule(projectId!)
      }
      return null
    },
    onSuccess: () => { snapshotQuery.refetch() }
})

const reCrawlMutation = useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error('Missing website')
      const response = await fetch('/api/crawl/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ websiteId: projectId })
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        const error = new Error(payload?.message || 'Failed to trigger crawl')
        ;(error as any).status = response.status
        ;(error as any).details = payload ?? null
        throw error
      }
      return payload
    },
    onMutate: () => {
      setReCrawlMessage(null)
    },
    onSuccess: (payload: any) => {
      const status = typeof payload?.status === 'string' ? payload.status : ''
      setReCrawlMessage(status === 'running' ? 'Crawl already running' : 'Re-crawl queued')
      setReCrawlNextEligibleAt(typeof payload?.nextEligibleAt === 'string' ? payload.nextEligibleAt : null)
      snapshotQuery.refetch()
    },
    onError: (error: any) => {
      const statusCode = Number(error?.status ?? error?.details?.status ?? 0)
      const nextEligible: string | null =
        typeof error?.details?.nextEligibleAt === 'string'
          ? error.details.nextEligibleAt
          : typeof error?.details?.nextEligible_at === 'string'
          ? error.details.nextEligible_at
          : null
      if (statusCode === 429) {
        setReCrawlMessage(nextEligible ? `Re-crawl available ${formatRelativeTime(nextEligible)}` : 'Re-crawl on cooldown')
        setReCrawlNextEligibleAt(nextEligible)
      } else if (statusCode === 503) {
        setReCrawlMessage('Crawl queue unavailable; try again later')
        setReCrawlNextEligibleAt(null)
      } else {
        setReCrawlMessage('Failed to trigger re-crawl')
        setReCrawlNextEligibleAt(null)
      }
    }
})

  const crawlStatus = insight.crawlStatus
  const crawlCooldownExpiresAt = insight.crawlCooldownExpiresAt
  const lastCrawlAt = insight.lastCrawlAt
  const playwrightWorkers = insight.playwrightWorkers
  const effectiveNextEligibleAt = reCrawlNextEligibleAt ?? crawlCooldownExpiresAt
  const disableReCrawl =
    mockEnabled ||
    !projectId ||
    reCrawlMutation.isPending ||
    crawlStatus === 'running' ||
    crawlStatus === 'cooldown'
  const reCrawlButtonLabel =
    crawlStatus === 'running'
      ? 'Crawl running'
      : crawlStatus === 'cooldown'
      ? 'Cooldown'
      : reCrawlMutation.isPending
      ? 'Starting…'
      : 'Re-crawl'
  const reCrawlStatusText = (() => {
    if (mockEnabled) return 'Mock data active'
    if (reCrawlMutation.isPending) return 'Starting re-crawl…'
    if (crawlStatus === 'running') {
      const workersNote = playwrightWorkers ? ` · ${playwrightWorkers.active}/${playwrightWorkers.max} workers active` : ''
      return lastCrawlAt ? `Crawl running (started ${formatRelativeTime(lastCrawlAt)})${workersNote}` : `Crawl running${workersNote}`
    }
    if (crawlStatus === 'cooldown') {
      return effectiveNextEligibleAt ? `Re-crawl available ${formatRelativeTime(effectiveNextEligibleAt)}` : 'Re-crawl on cooldown'
    }
    if (reCrawlMessage) {
      return reCrawlNextEligibleAt ? `${reCrawlMessage} (${formatRelativeTime(reCrawlNextEligibleAt)})` : reCrawlMessage
    }
    if (lastCrawlAt) return `Last crawl ${formatRelativeTime(lastCrawlAt)}`
    return null
  })()

  useEffect(() => {
    if (reCrawlMutation.isPending) return
    if (crawlStatus === 'idle') {
      if (reCrawlNextEligibleAt !== null) setReCrawlNextEligibleAt(null)
      if (reCrawlMessage && !reCrawlMessage.toLowerCase().includes('failed')) {
        setReCrawlMessage(null)
      }
    } else if (crawlStatus === 'cooldown') {
      if (!reCrawlNextEligibleAt && crawlCooldownExpiresAt) {
        setReCrawlNextEligibleAt(crawlCooldownExpiresAt)
      }
    } else if (crawlStatus === 'running') {
      if (reCrawlNextEligibleAt !== null) setReCrawlNextEligibleAt(null)
    }
  }, [crawlStatus, crawlCooldownExpiresAt, reCrawlMutation.isPending, reCrawlMessage, reCrawlNextEligibleAt])

  if (!projectId) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Add your website to start crawling and planning content.</p>
        </header>
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No website yet</EmptyTitle>
            <EmptyDescription>Enter your site URL to create and begin.</EmptyDescription>
          </EmptyHeader>
        </Empty>
        <div className="max-w-3xl">
          <OnboardingForm isAuthed redirectIfAuthenticated={false} />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
      </header>

      {showTrialBanner ? (
        <section className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1 text-sm">
              <p className="font-semibold text-primary">Trial runway ready</p>
              <p className="text-muted-foreground">
                {`Outlines scheduled through ${formatCalendarDate(trialOutlinesThrough)}. ${fullyGeneratedCount >= 3 ? 'First three drafts are ready to review.' : 'First three drafts will be generated automatically.'}`}
              </p>
              <p className="text-xs text-muted-foreground">
                {complimentaryLimit > 0
                  ? `${complimentaryRemaining} of ${complimentaryLimit} complimentary articles remaining`
                  : 'Complimentary articles complete'}
              </p>
              {trialEndsAt ? (
                <p className="text-xs text-muted-foreground">{`Trial ends ${formatRelativeTime(trialEndsAt)}.`}</p>
              ) : null}
              {billingMessage ? <p className="text-xs text-destructive">{billingMessage}</p> : null}
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                if (mockEnabled) return
                subscribeMutation.mutate()
              }}
              disabled={subscribeMutation.isPending}
            >
              {subscribeMutation.isPending ? 'Redirecting…' : 'Unlock full generation'}
            </Button>
          </div>
        </section>
      ) : null}

      {showComplimentaryBanner ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1 text-sm">
              <p className="font-semibold text-amber-800">Complimentary preview unlocked</p>
              <p className="text-muted-foreground">
                {`Outlines scheduled through ${formatCalendarDate(trialOutlinesThrough)}. First three drafts will be generated automatically.`}
              </p>
              <p className="text-xs text-muted-foreground">{`${complimentaryRemaining} of ${complimentaryLimit} complimentary articles remaining.`}</p>
              {billingMessage ? <p className="text-xs text-destructive">{billingMessage}</p> : null}
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                if (mockEnabled) return
                subscribeMutation.mutate()
              }}
              disabled={subscribeMutation.isPending}
            >
              {subscribeMutation.isPending ? 'Redirecting…' : 'Upgrade for full access'}
            </Button>
          </div>
        </section>
      ) : null}

      {showActiveBanner ? (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 text-sm text-emerald-900">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="font-semibold">Subscription active</p>
              <p className="text-muted-foreground">
                {activeUntil ? `Runway maintained through ${formatCalendarDate(activeUntil)}.` : 'Runway maintained for the current billing period.'}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Website Summary</h2>
            <p className="text-sm text-muted-foreground">Business context of the website: products, services, audience, positioning.</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={isEditingSummary ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
              if (mockEnabled || crawlStatus === 'running') return
              if (isEditingSummary) {
                saveSummaryMutation.mutate(draftSummary.trim())
              } else {
                setDraftSummary((project?.summary ?? insight.summaryText).trim())
                setIsEditingSummary(true)
              }
            }}
            disabled={
              mockEnabled ||
              crawlStatus === 'running' ||
              (isEditingSummary && draftSummary.trim().length === 0) ||
              saveSummaryMutation.isPending
            }
          >
            {mockEnabled ? 'Mock data' : isEditingSummary ? (saveSummaryMutation.isPending ? 'Saving…' : 'Save summary') : 'Edit summary'}
          </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (mockEnabled || !projectId) return
                  reCrawlMutation.mutate()
                }}
                disabled={disableReCrawl}
              >
                {reCrawlButtonLabel}
              </Button>
            </div>
            {reCrawlStatusText ? (
              <span className="text-xs text-muted-foreground text-right">{reCrawlStatusText}</span>
            ) : null}
          </div>
        </div>
        <Textarea
          readOnly={!isEditingSummary || mockEnabled || crawlStatus === 'running'}
          value={isEditingSummary ? draftSummary : insight.summaryText}
          onChange={(event) => setDraftSummary(event.target.value)}
          className="mt-4 min-h-[220px] resize-none bg-background/90 text-sm leading-relaxed"
        />
        {isEditingSummary && !mockEnabled ? (
          <div className="mt-2 flex justify-end text-xs text-muted-foreground">Press save to persist changes.</div>
        ) : null}
      </section>

      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Website status</h2>
            <p className="text-sm text-muted-foreground">Key automation steps from ingestion to scheduling.</p>
          </div>
        </div>
        <ol className="mt-4 space-y-3">
          {insight.projectStatus.map((step) => (
            <li
              key={step.label}
              className="flex flex-wrap items-start gap-3 rounded-md border border-border/70 px-3 py-3"
            >
              <div
                className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                  step.state === 'done'
                    ? 'bg-emerald-500'
                    : step.state === 'active'
                    ? 'bg-amber-400'
                    : 'bg-muted-foreground/40'
                } ${step.state === 'active' ? 'animate-pulse' : ''}`}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1 space-y-2 text-sm">
                <div className="space-y-1">
                  <p className="font-medium text-foreground">{step.label}</p>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
                {step.metric?.kind === 'progress' ? (
                  <div className="space-y-1 pt-1">
                    <Progress value={step.metric.value} className="h-2 bg-primary/15" />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{step.metric.label}</span>
                      {step.metric.counts && !step.metric.counts.hidden ? (
                        <span className="font-medium text-foreground">
                          {`${formatNumber(step.metric.counts.current)} / ${formatNumber(step.metric.counts.total)}`}
                        </span>
                      ) : null}
                    </div>
                    {step.metric.note ? (
                      <div className="text-[11px] text-muted-foreground/80">
                        {step.metric.note}
                      </div>
                    ) : null}
                    {step.metric.counts?.hidden && step.metric.ariaLabel ? (
                      <span className="sr-only">{step.metric.ariaLabel}</span>
                    ) : null}
                  </div>
                ) : null}
                {step.metric?.kind === 'counter' ? (
                  <CounterReadout
                    label={step.metric.label}
                    value={step.metric.total}
                    durationMs={step.metric.durationMs}
                  />
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-semibold uppercase tracking-wide ${
                    step.state === 'done'
                      ? 'text-emerald-500'
                      : step.state === 'active'
                      ? 'text-amber-400'
                      : 'text-muted-foreground'
                  }`}
                >
                  {step.badge}
                </span>
                {step.action && step.state !== 'done' ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => mergeActionMutation.mutate(step.action)}
                    disabled={mockEnabled || mergeActionMutation.isPending}
                  >
                    {mergeActionMutation.isPending ? 'Running…' : step.action.label}
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}

function buildInsights(website: any | null | undefined, snapshot: any | null | undefined) {
  const keywords = snapshot?.keywords ?? []
  const planItems = snapshot?.planItems ?? []
  const queueDepth = snapshot?.queueDepth ?? 0
  const scheduledCount = planItems.filter((p: any) => (p.status || '').toLowerCase() === 'scheduled').length
  const generatedCount = planItems.length

  const hasSummary = Boolean(website?.summary?.trim())
  const summaryText = hasSummary ? String(website?.summary).trim() : DEFAULT_CONTEXT

  const crawlProgress = normalizeCrawlProgress(snapshot?.crawlProgress)
  const keywordProgress = normalizeKeywordProgress(snapshot?.keywordProgress, keywords.length)
  const articleProgress = normalizeArticleProgress(snapshot?.articleProgress, generatedCount, scheduledCount)
  const crawlStatus = (snapshot?.crawlStatus as 'idle' | 'running' | 'cooldown') ?? 'idle'
  const crawlCooldownExpiresAt = typeof snapshot?.crawlCooldownExpiresAt === 'string' ? snapshot.crawlCooldownExpiresAt : null
  const lastCrawlAt = typeof snapshot?.lastCrawlAt === 'string' ? snapshot.lastCrawlAt : null
  const playwrightWorkers = snapshot?.playwrightWorkers && typeof snapshot.playwrightWorkers === 'object'
    ? {
        active: Number(snapshot.playwrightWorkers.active) || 0,
        max: Number(snapshot.playwrightWorkers.max) || 0
      }
    : null

  const projectStatus = buildProjectStatus({
    project: website,
    hasSummary,
    keywordsCount: keywords.length,
    queueDepth,
    crawlProgress,
    keywordProgress,
    articleProgress,
    crawlStatus,
    crawlCooldownExpiresAt,
    lastCrawlAt,
    playwrightWorkers
  })

  return {
    projectStatus,
    summaryText,
    crawlStatus,
    crawlCooldownExpiresAt,
    lastCrawlAt,
    playwrightWorkers
  }
}

const DEFAULT_CONTEXT = `Interview prep platform helping candidates practice behavioral questions with AI-guided drills.

Audience:
Primary buyer: HR and hiring managers prioritizing fast interview prep. Secondary: individual candidates in tech roles.

Jobs-to-be-done:
Help candidates feel confident for behavioral interviews with feedback loops in under 30 minutes a day.

Differentiation:
AI scoring trained on FAANG interview rubrics; targeted rehearse flows instead of generic flashcards.`

type ProjectStatusAction =
  | { type: 'crawl'; label: string }
  | { type: 'generateKeywords'; label: string }
  | { type: 'schedulePlan'; label: string }
  | null

type ProjectStatusMetric =
  | {
      kind: 'progress'
      value: number
      label: string
      counts?: { current: number; total: number; hidden?: boolean }
      ariaLabel?: string
      note?: string
    }
  | {
      kind: 'counter'
      label: string
      total: number
      durationMs?: number
    }

type ProjectStatusStep = {
  label: string
  description: string
  state: 'done' | 'active' | 'pending'
  badge: string
  action: ProjectStatusAction
  metric?: ProjectStatusMetric
}

type NormalizedCrawlProgress = {
  crawledCount: number
  targetCount: number
  startedAt: string | null
  completedAt: string | null
}

type NormalizedKeywordProgress = {
  total: number
}

type NormalizedArticleProgress = {
  generatedCount: number
  scheduledCount: number
  fullyGeneratedCount?: number
  targetCount: number
}

function buildProjectStatus({
  project,
  hasSummary,
  keywordsCount,
  queueDepth,
  crawlProgress,
  keywordProgress,
  articleProgress,
  crawlStatus,
  crawlCooldownExpiresAt,
  lastCrawlAt,
  playwrightWorkers
}: {
  project: any | null | undefined
  hasSummary: boolean
  keywordsCount: number
  queueDepth: number
  crawlProgress: NormalizedCrawlProgress
  keywordProgress: NormalizedKeywordProgress
  articleProgress: NormalizedArticleProgress
  crawlStatus: 'idle' | 'running' | 'cooldown'
  crawlCooldownExpiresAt: string | null
  lastCrawlAt: string | null
  playwrightWorkers: { active: number; max: number } | null
}): ProjectStatusStep[] {
  const steps = [
    {
      id: 'input' as const,
      label: 'Input website',
      description: project?.url ? `Tracking ${project.url}` : 'Connect a site to begin generating keywords.',
      completed: Boolean(project?.url),
      action: null as ProjectStatusAction
    },
    {
      id: 'crawl' as const,
      label: 'Crawl website & summarize context',
      description: hasSummary ? 'Summary captured for alignment.' : 'Kick off a crawl to collect context.',
      completed: hasSummary,
      action: { type: 'crawl', label: 'Run crawl' } as ProjectStatusAction
    },
    {
      id: 'keywords' as const,
      label: 'Generate website keywords',
      description: keywordsCount > 0 ? `${formatNumber(keywordsCount)} keywords generated.` : 'Kick off keyword generation.',
      completed: keywordsCount > 0,
      action: { type: 'generateKeywords', label: 'Generate keywords' } as ProjectStatusAction
    },
    {
      id: 'articles' as const,
      label: 'Start daily scheduling of articles',
      description:
        articleProgress.generatedCount > 0
          ? `${formatNumber(articleProgress.generatedCount)} skeletons generated.`
          : 'Schedule plan items to feed the calendar.',
      completed: articleProgress.generatedCount > 0,
      action: { type: 'schedulePlan', label: 'Schedule articles' } as ProjectStatusAction
    }
  ]

  return steps.map((step, index) => {
    const allPrevComplete = steps.slice(0, index).every((prev) => prev.completed)
    const state: 'done' | 'active' | 'pending' = step.completed ? 'done' : allPrevComplete ? 'active' : 'pending'
    let badge = step.completed ? 'Done' : state === 'active' ? 'In progress' : 'To do'

    let metric: ProjectStatusMetric | undefined
    if (step.id === 'crawl') {
      const percent = computePercent(crawlProgress.crawledCount, crawlProgress.targetCount)
      if (state !== 'pending' || percent > 0) {
        if (!step.completed) {
          if (crawlStatus === 'running') badge = 'Running'
          else if (crawlStatus === 'cooldown') badge = 'Cooldown'
        }
        const noteParts: string[] = []
        if (crawlStatus === 'running' && crawlProgress.startedAt) {
          noteParts.push(`Started ${formatRelativeTime(crawlProgress.startedAt)}`)
        } else if (crawlStatus === 'cooldown' && crawlCooldownExpiresAt) {
          noteParts.push(`Available ${formatRelativeTime(crawlCooldownExpiresAt)}`)
        } else if (lastCrawlAt) {
          noteParts.push(`Last crawl ${formatRelativeTime(lastCrawlAt)}`)
        }
        if (crawlStatus === 'running' && playwrightWorkers) {
          noteParts.push(`${playwrightWorkers.active}/${playwrightWorkers.max} workers active`)
        }
        metric = {
          kind: 'progress',
          value: percent,
          label: `${percent}% of crawl budget`,
          ariaLabel: `Crawl progress ${percent} percent`,
          note: noteParts.length ? noteParts.join(' · ') : undefined
        }
      }
    } else if (step.id === 'keywords') {
      if (keywordProgress.total > 0) {
        metric = {
          kind: 'counter',
          label: 'Keywords generated',
          total: keywordProgress.total,
          durationMs: 3600
        }
      }
    } else if (step.id === 'articles') {
      const percent = computePercent(articleProgress.generatedCount, articleProgress.targetCount)
      if (state !== 'pending' || percent > 0) {
        const noteParts: string[] = []
        if (articleProgress.scheduledCount > 0) {
          noteParts.push(`${pluralize(articleProgress.scheduledCount, 'article')} scheduled`)
        }
        if (queueDepth > 0) {
          noteParts.push(`${pluralize(queueDepth, 'draft')} queued`)
        }
        metric = {
          kind: 'progress',
          value: percent,
          label: `${percent}% of skeleton batch`,
          counts: {
            current: articleProgress.generatedCount,
            total: articleProgress.targetCount,
            hidden: false
          },
          note: noteParts.length > 0 ? noteParts.join(' · ') : undefined
        }
      }
    }

    return {
      label: step.label,
      description: step.description,
      state,
      badge,
      action: step.action,
      metric
    }
  })
}

function CounterReadout({
  label,
  value,
  durationMs = 3200
}: {
  label: string
  value: number
  durationMs?: number
}) {
  const [displayValue, setDisplayValue] = useState(0)
  const rafRef = useRef<number | null>(null)
  const previousValueRef = useRef<number>(-1)

  useEffect(() => {
    if (value <= 0) {
      previousValueRef.current = value
      setDisplayValue(0)
      return
    }
    if (value === previousValueRef.current) return
    previousValueRef.current = value

    const start = performance.now()
    const from = 0

    const animate = (now: number) => {
      const elapsed = now - start
      const progress = durationMs > 0 ? Math.min(1, elapsed / durationMs) : 1
      const eased = easeOutCubic(progress)
      const next = Math.round(from + (value - from) * eased)
      setDisplayValue(next)
      if (progress < 1) rafRef.current = requestAnimationFrame(animate)
    }

    setDisplayValue(0)
    rafRef.current = requestAnimationFrame(animate)

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [value, durationMs])

  return (
    <div className="flex items-end justify-between pt-1" aria-live="polite">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-lg font-semibold tabular-nums">{formatNumber(displayValue)}</span>
    </div>
  )
}

function normalizeCrawlProgress(raw: any): NormalizedCrawlProgress {
  const target = Math.max(1, Number(raw?.targetCount ?? 50) || 1)
  const crawled = Math.max(0, Number(raw?.crawledCount ?? 0) || 0)
  return {
    crawledCount: Math.min(crawled, target),
    targetCount: target,
    startedAt: raw?.startedAt ?? null,
    completedAt: raw?.completedAt ?? null
  }
}

function normalizeKeywordProgress(raw: any, fallbackTotal: number): NormalizedKeywordProgress {
  const total = Math.max(0, Number(raw?.total ?? fallbackTotal ?? 0) || 0)
  return { total }
}

function normalizeArticleProgress(
  raw: any,
  generatedFallback: number,
  scheduledFallback: number
): NormalizedArticleProgress {
  const target = Math.max(1, Number(raw?.targetCount ?? Math.max(generatedFallback, 30)) || 30)
  const generated = Math.max(0, Number(raw?.generatedCount ?? generatedFallback ?? 0) || 0)
  const scheduled = Math.max(0, Number(raw?.scheduledCount ?? scheduledFallback ?? 0) || 0)
  const fullyGenerated = Math.max(0, Number(raw?.fullyGeneratedCount ?? 0) || 0)
  return {
    generatedCount: Math.min(generated, target),
    scheduledCount: Math.min(scheduled, target),
    fullyGeneratedCount: Math.min(fullyGenerated, target),
    targetCount: target
  }
}

function computePercent(current: number, total: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(total) || total <= 0) return 0
  return clamp(Math.round((current / total) * 100), 0, 100)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function formatRelativeTime(iso: string): string {
  if (!iso) return ''
  const target = new Date(iso)
  if (Number.isNaN(target.getTime())) return ''
  const diffMs = target.getTime() - Date.now()
  const absMinutes = Math.round(Math.abs(diffMs) / 60000)
  if (absMinutes >= 1440) {
    const days = Math.round(absMinutes / 1440)
    const label = pluralize(days, 'day')
    return diffMs >= 0 ? `in ${label}` : `${label} ago`
  }
  if (absMinutes >= 60) {
    const hours = Math.round(absMinutes / 60)
    const label = pluralize(hours, 'hour')
    return diffMs >= 0 ? `in ${label}` : `${label} ago`
  }
  if (absMinutes >= 1) {
    const label = pluralize(absMinutes, 'minute')
    return diffMs >= 0 ? `in ${label}` : `${label} ago`
  }
  return diffMs >= 0 ? 'soon' : 'just now'
}

function formatCalendarDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return String(iso)
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

function formatNumber(value: number): string {
  const safe = Number.isFinite(value) ? value : 0
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.max(0, Math.round(safe)))
}

function pluralize(count: number, singular: string, plural?: string): string {
  const word = count === 1 ? singular : plural ?? `${singular}s`
  return `${formatNumber(count)} ${word}`
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}
