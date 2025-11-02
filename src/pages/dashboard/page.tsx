import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useActiveProject } from '@common/state/active-project'
import { useMockData } from '@common/dev/mock-data-context'
import { getProject, getProjectSnapshot } from '@entities/project/service'
import type { Keyword, PlanItem, Project, ProjectSnapshot } from '@entities'
import { Button } from '@src/common/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@src/common/ui/empty'

type DashboardData = {
  project: Project | null
  snapshot: ProjectSnapshot | null
}

const MOCK_PLAN_ITEMS: PlanItem[] = [
  {
    id: 'plan-1',
    projectId: 'proj_mock',
    title: 'Create 30-60-90 Day Plan Template',
    plannedDate: new Date().toISOString(),
    status: 'scheduled'
  },
  {
    id: 'plan-2',
    projectId: 'proj_mock',
    title: 'Behavioral STAR Method Examples',
    plannedDate: new Date(Date.now() + 86_400_000).toISOString(),
    status: 'draft'
  }
]

const MOCK_KEYWORDS: Keyword[] = [
  {
    id: 'kw-1',
    projectId: 'proj_mock',
    canonId: 'kw-1',
    phrase: 'interview practice questions',
    metricsJson: { searchVolume: 5400, difficulty: 38, asOf: new Date().toISOString() }
  },
  {
    id: 'kw-2',
    projectId: 'proj_mock',
    canonId: 'kw-2',
    phrase: 'mock interview ai',
    metricsJson: { searchVolume: 2600, difficulty: 42, asOf: new Date().toISOString() }
  }
]

const MOCK_DASHBOARD: DashboardData = {
  project: {
    id: 'proj_mock',
    orgId: 'org_mock',
    name: 'Prep Interview',
    siteUrl: 'https://prepinterview.ai',
    defaultLocale: 'en-US',
    status: 'active',
    businessSummary: [
      'Interview prep platform helping candidates practice behavioral questions with AI-guided drills.',
      'Key value props: real interview simulation, instant scoring, targeted feedback for tech roles.'
    ].join('\n')
  },
  snapshot: {
    queueDepth: 2,
    planItems: MOCK_PLAN_ITEMS,
    keywords: MOCK_KEYWORDS,
    latestDiscovery: {
      startedAt: new Date(Date.now() - 3600_000 * 6).toISOString(),
      completedAt: new Date(Date.now() - 3600_000 * 2).toISOString(),
      providersUsed: ['crawl', 'serp'],
      seedCount: 42,
      keywordCount: 215
    }
  }
}

export function Page(): JSX.Element {
  const { id: projectId } = useActiveProject()
  const { enabled: mockEnabled } = useMockData()

  const projectQuery = useQuery({
    queryKey: ['dashboard.project', projectId],
    queryFn: () => getProject(projectId!),
    enabled: Boolean(projectId && !mockEnabled)
  })

  const snapshotQuery = useQuery({
    queryKey: ['dashboard.snapshot', projectId],
    queryFn: () => getProjectSnapshot(projectId!),
    enabled: Boolean(projectId && !mockEnabled),
    refetchInterval: 30_000
  })

  const project = mockEnabled ? MOCK_DASHBOARD.project : projectQuery.data
  const snapshot = mockEnabled ? MOCK_DASHBOARD.snapshot : snapshotQuery.data

  const insight = useMemo(() => buildInsights(project, snapshot), [project, snapshot])

  if (!projectId) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Pick a project to see its health and next steps.</p>
        </header>
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No project selected</EmptyTitle>
            <EmptyDescription>Choose a project from the sidebar to load its summary.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Website context, prep interview notes, and workflow at a glance.</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {insight.statusCards.map((card) => (
          <article key={card.label} className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{card.label}</div>
            <div className="mt-2 text-xl font-semibold text-foreground">{card.value}</div>
            {card.detail ? <p className="mt-1 text-xs text-muted-foreground">{card.detail}</p> : null}
          </article>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <article className="rounded-lg border bg-card p-5 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Business Summary</h2>
            <p className="text-sm text-muted-foreground">Keep the team anchored on the business narrative.</p>
          </div>
          <div className="mt-4 whitespace-pre-wrap rounded-md border border-dashed border-border/70 bg-background/70 p-4 text-sm leading-relaxed text-muted-foreground">
            {(project?.businessSummary?.trim() || insight.fallbackSummary).trim()}
          </div>
        </article>

        <article className="rounded-lg border bg-card p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">Prep Interview Notes</h2>
          <p className="mt-1 text-sm text-muted-foreground">Align messaging before talking to stakeholders.</p>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            {insight.prepPoints.map((item) => (
              <li key={item.title} className="rounded-md border border-dashed border-border/60 px-3 py-2">
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.detail}</p>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Workflow</h2>
            <p className="text-sm text-muted-foreground">Move from discovery to published articles with clear checkpoints.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (mockEnabled) return
              snapshotQuery.refetch()
            }}
            disabled={mockEnabled || snapshotQuery.isRefetching}
          >
            {snapshotQuery.isRefetching ? 'Refreshing…' : mockEnabled ? 'Mock data' : 'Refresh data'}
          </Button>
        </div>
        <ol className="mt-4 space-y-4">
          {insight.workflow.map((step) => (
            <li key={step.label} className="flex items-start gap-3 rounded-md border border-border/70 px-3 py-2">
              <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${step.state === 'done' ? 'bg-emerald-500' : step.state === 'active' ? 'bg-blue-500' : 'bg-muted-foreground/50'}`} />
              <div className="space-y-1 text-sm">
                <p className="font-medium text-foreground">{step.label}</p>
                <p className="text-xs text-muted-foreground">{step.description}</p>
              </div>
              <span className={`ml-auto text-xs font-semibold uppercase tracking-wide ${step.state === 'done' ? 'text-emerald-500' : step.state === 'active' ? 'text-blue-500' : 'text-muted-foreground'}`}>
                {step.badge}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}

function buildInsights(project: Project | null | undefined, snapshot: ProjectSnapshot | null | undefined) {
  const keywords = snapshot?.keywords ?? []
  const planItems = snapshot?.planItems ?? []
  const queueDepth = snapshot?.queueDepth ?? 0
  const totalPublished = planItems.filter((p) => p.status === 'published').length
  const scheduled = planItems.filter((p) => p.status === 'scheduled').length

  const statusCards = [
    {
      label: 'Workflow state',
      value: project?.workflowState ? titleCase(project.workflowState) : 'In discovery',
      detail: project?.status ? titleCase(project.status) : 'Status pending'
    },
    {
      label: 'Keywords reviewed',
      value: keywords.length > 0 ? `${keywords.length}` : '0',
      detail: keywords.length > 0 ? 'Ready to prioritize' : 'Generate the first batch'
    },
    {
      label: 'Publishing queue',
      value: queueDepth.toString(),
      detail: queueDepth > 0 ? 'Jobs in progress' : 'Queue is clear'
    },
    {
      label: 'Calendar',
      value: scheduled > 0 ? `${scheduled} scheduled` : 'No items',
      detail: totalPublished > 0 ? `${totalPublished} published` : 'Publish your first draft'
    }
  ]

  const workflow = [
    {
      label: 'Discovery',
      description: project?.discoveryApproved ? 'Discovery approved. Seeds captured.' : 'Review discovery summary before moving on.',
      state: project?.discoveryApproved ? 'done' : 'active',
      badge: project?.discoveryApproved ? 'Approved' : 'Needs review'
    },
    {
      label: 'Keyword prioritization',
      description: keywords.length > 0 ? 'Prioritize the keywords that match the business goals.' : 'Generate and triage your keyword list.',
      state: keywords.length > 0 ? 'done' : 'pending',
      badge: keywords.length > 0 ? 'Ready' : 'Pending'
    },
    {
      label: 'Scheduling',
      description: scheduled > 0 ? 'Calendar populated. Keep the queue full.' : 'Schedule plan items to build a runway.',
      state: scheduled > 0 ? 'active' : 'pending',
      badge: scheduled > 0 ? 'In progress' : 'To do'
    }
  ] as Array<{ label: string; description: string; badge: string; state: 'pending' | 'active' | 'done' }>

  const prepPoints = [
    {
      title: 'Audience',
      detail:
        'Primary buyer: HR and hiring managers prioritizing fast interview prep. Secondary: individual candidates in tech roles.'
    },
    {
      title: 'Jobs-to-be-done',
      detail: 'Help candidates feel confident for behavioral interviews with feedback loops in under 30 minutes a day.'
    },
    {
      title: 'Differentiation',
      detail: 'AI scoring trained on FAANG interview rubrics; targeted rehearse flows instead of generic flashcards.'
    }
  ]

  return {
    statusCards,
    workflow,
    prepPoints,
    fallbackSummary:
      'Describe the business model, target personas, and success metrics here so copy, keywords, and publishing decisions stay aligned.'
  }
}

function titleCase(input: string) {
  return input
    .split(/[_\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
