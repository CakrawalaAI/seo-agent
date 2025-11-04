import { useEffect, useMemo, useState } from 'react'
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
            <li key={step.label} className="flex flex-wrap items-start gap-3 rounded-md border border-border/70 px-3 py-3">
              <div className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${step.state === 'done' ? 'bg-emerald-500' : step.state === 'active' ? 'bg-blue-500' : 'bg-muted-foreground/40'}`} />
              <div className="min-w-0 flex-1 space-y-1 text-sm">
                <p className="font-medium text-foreground">{step.label}</p>
                <p className="text-xs text-muted-foreground">{step.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold uppercase tracking-wide ${step.state === 'done' ? 'text-emerald-500' : step.state === 'active' ? 'text-blue-500' : 'text-muted-foreground'}`}>
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
  const scheduledCount = planItems.filter((p: any) => p.status === 'scheduled').length
  const hasSummary = Boolean(website?.summary?.trim())

  const summaryText = hasSummary ? String(website?.summary).trim() : DEFAULT_CONTEXT

  const projectStatus = buildProjectStatus({
    project: website,
    hasSummary,
    keywordsCount: keywords.length,
    queueDepth,
    scheduledCount
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

type ProjectStatusStep = ReturnType<typeof buildProjectStatus>[number]

function buildProjectStatus({
  project,
  hasSummary,
  keywordsCount,
  queueDepth,
  scheduledCount
}: {
  project: any | null | undefined
  hasSummary: boolean
  keywordsCount: number
  queueDepth: number
  scheduledCount: number
}) {
  const steps = [
    {
      label: 'Input website',
      description: project?.url ? `Tracking ${project.url}` : 'Connect a site to begin generating keywords.',
      completed: Boolean(project?.url),
      action: null
    },
    {
      label: 'Crawl website & summarize context',
      description: hasSummary ? 'Summary captured for alignment.' : 'Kick off a crawl to collect context.',
      completed: hasSummary,
      action: { type: 'crawl', label: 'Run crawl' } as const
    },
    {
      label: 'Generate website keywords',
      description: keywordsCount > 0 ? `${keywordsCount} keywords generated.` : 'Kick off keyword generation.',
      completed: keywordsCount > 0,
      action: { type: 'generateKeywords', label: 'Generate keywords' } as const
    },
    {
      label: 'Start daily scheduling of articles',
      description: scheduledCount > 0 ? `${scheduledCount} articles scheduled.` : 'Schedule plan items to feed the calendar.',
      completed: scheduledCount > 0,
      action: { type: 'schedulePlan', label: 'Schedule articles' } as const
    }
  ] as const

  return steps.map((step, index) => {
    const allPrevComplete = steps.slice(0, index).every((prev) => prev.completed)
    const state: 'done' | 'active' | 'pending' = step.completed ? 'done' : allPrevComplete ? 'active' : 'pending'
    const badge = step.completed ? 'Done' : state === 'active' ? 'In progress' : 'To do'
    return {
      label: step.label,
      description: step.description,
      state,
      badge,
      action: step.action
    }
  })
}
