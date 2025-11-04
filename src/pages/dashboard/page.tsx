import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useActiveWebsite } from '@common/state/active-website'
import { useMockData } from '@common/dev/mock-data-context'
import { getWebsite, getWebsiteSnapshot, runSchedule } from '@entities/website/service'
import type { Keyword } from '@entities'
import type { PlanItem } from '@entities/article/planner'
import { Button } from '@src/common/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@src/common/ui/empty'
import { Textarea } from '@src/common/ui/textarea'
import { OnboardingForm } from '@features/onboarding/client/onboarding-form'
import { Progress } from '@src/common/ui/progress'

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

  const insight = useMemo(() => buildInsights(project, snapshot), [project, snapshot])

  const [isEditingSummary, setIsEditingSummary] = useState(false)
  const [draftSummary, setDraftSummary] = useState(() => project?.summary ?? insight.summaryText)

  useEffect(() => {
    if (mockEnabled) return
    if (isEditingSummary) return
    setDraftSummary((project?.summary ?? insight.summaryText).trim())
  }, [isEditingSummary, project?.summary, insight.summaryText, mockEnabled])

  const saveSummaryMutation = useMutation({
    mutationFn: async (_summary: string) => null,
    onSuccess: () => { setIsEditingSummary(false) }
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

      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Website Summary</h2>
            <p className="text-sm text-muted-foreground">Business context of the website: products, services, audience, positioning.</p>
          </div>
          <Button
            type="button"
            variant={isEditingSummary ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              if (mockEnabled) return
              if (isEditingSummary) {
                saveSummaryMutation.mutate(draftSummary.trim())
              } else {
                setDraftSummary((project?.summary ?? insight.summaryText).trim())
                setIsEditingSummary(true)
              }
            }}
            disabled={mockEnabled || (isEditingSummary && draftSummary.trim().length === 0) || saveSummaryMutation.isPending}
          >
            {mockEnabled ? 'Mock data' : isEditingSummary ? (saveSummaryMutation.isPending ? 'Saving…' : 'Save summary') : 'Edit summary'}
          </Button>
        </div>
        <Textarea
          readOnly={!isEditingSummary || mockEnabled}
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

  const projectStatus = buildProjectStatus({
    project: website,
    hasSummary,
    keywordsCount: keywords.length,
    queueDepth,
    crawlProgress,
    keywordProgress,
    articleProgress
  })

  return {
    projectStatus,
    summaryText
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
  targetCount: number
}

function buildProjectStatus({
  project,
  hasSummary,
  keywordsCount,
  queueDepth,
  crawlProgress,
  keywordProgress,
  articleProgress
}: {
  project: any | null | undefined
  hasSummary: boolean
  keywordsCount: number
  queueDepth: number
  crawlProgress: NormalizedCrawlProgress
  keywordProgress: NormalizedKeywordProgress
  articleProgress: NormalizedArticleProgress
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
    const badge = step.completed ? 'Done' : state === 'active' ? 'In progress' : 'To do'

    let metric: ProjectStatusMetric | undefined
    if (step.id === 'crawl') {
      const percent = computePercent(crawlProgress.crawledCount, crawlProgress.targetCount)
      if (state !== 'pending' || percent > 0) {
        metric = {
          kind: 'progress',
          value: percent,
          label: `${percent}% of crawl budget`,
          ariaLabel: `Crawl progress ${percent} percent`
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
  return {
    generatedCount: Math.min(generated, target),
    scheduledCount: Math.min(scheduled, target),
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
