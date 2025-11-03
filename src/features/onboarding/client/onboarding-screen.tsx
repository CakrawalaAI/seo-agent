import { useEffect, useMemo, useState, useRef } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Circle, Loader2, Sparkles, ArrowRight, Calendar, AlertTriangle } from 'lucide-react'
import { getProject, getProjectSnapshot } from '@entities/project/service'
import type { PlanItem, Project, ProjectSnapshot, MeSession, Keyword } from '@entities'
import { Badge } from '@src/common/ui/badge'
import { cn } from '@src/common/ui/cn'
import { Alert, AlertDescription, AlertTitle } from '@src/common/ui/alert'
import { trackOnboardingEvent } from './telemetry'

type OnboardingPhase = 'initializing' | 'sitemap' | 'crawling' | 'keywording' | 'planning' | 'ready'

const PHASES: OnboardingPhase[] = ['initializing', 'sitemap', 'crawling', 'keywording', 'planning', 'ready']

const MAX_FEED_ITEMS = 7

type CrawlFeedItem = {
  url: string
  status: 'pending' | 'queued' | 'complete' | 'failed'
}

export function OnboardingScreen({
  projectId,
  projectSlug,
  siteUrl,
  session
}: {
  projectId: string | null
  projectSlug?: string | null
  siteUrl?: string | null
  session: MeSession | null
}) {
  const navigate = useNavigate()
  const [timedOut, setTimedOut] = useState(false)
  const isLoggedIn = Boolean(session?.user?.email)
  const phaseRef = useRef<OnboardingPhase>('initializing')
  const phaseStartRef = useRef<number>(Date.now())
  const timeoutRef = useRef<number | null>(null)
  const abandonTracked = useRef(false)

  const projectQuery = useQuery<Project | null>({
    queryKey: ['project', projectId],
    queryFn: () => (projectId ? getProject(projectId) : Promise.resolve(null)),
    enabled: Boolean(projectId) && isLoggedIn,
    retry: isLoggedIn ? undefined : false
  })

  const snapshotQuery = useQuery<ProjectSnapshot | null>({
    queryKey: ['projectSnapshot', projectId],
    queryFn: () => (projectId ? getProjectSnapshot(projectId, { cache: 'no-store' }) : Promise.resolve(null)),
    enabled: Boolean(projectId) && isLoggedIn,
    retry: isLoggedIn ? undefined : false,
    refetchInterval: 5000
  })

  const snapshot = snapshotQuery.data ?? null
  const project = projectQuery.data ?? null

  const keywordFeed = useKeywordFeed(project, snapshot)

  const phase = derivePhase(snapshot, keywordFeed.length)
  const phaseIndex = PHASES.indexOf(phase)

  useEffect(() => {
    if (!projectId) return
    if (import.meta.env.DEV) {
      console.info('[onboarding.screen] query status', {
        projectId,
        projectStatus: projectQuery.status,
        snapshotStatus: snapshotQuery.status,
        isLoggedIn
      })
    }
  }, [projectId, projectQuery.status, snapshotQuery.status, isLoggedIn])

  useEffect(() => {
    if (!projectId) return
    const previousPhase = phaseRef.current
    if (previousPhase !== phase) {
      const now = Date.now()
      const durationMs = Math.max(0, now - phaseStartRef.current)
      if (import.meta.env.DEV) {
        console.info('[onboarding.screen] phase change', {
          projectId,
          from: previousPhase,
          to: phase,
          durationMs,
          crawlPages: snapshot?.crawlPages?.length ?? 0,
          keywordCount: snapshot?.latestDiscovery?.keywordCount ?? snapshot?.keywords?.length ?? 0,
          planItems: snapshot?.planItems?.length ?? 0
        })
      }
      trackOnboardingEvent('onboarding_phase_change', {
        projectId,
        fromPhase: previousPhase,
        toPhase: phase,
        durationMs,
        crawlPages: snapshot?.crawlPages?.length ?? 0,
        keywordCount: snapshot?.latestDiscovery?.keywordCount ?? snapshot?.keywords?.length ?? 0,
        planItems: snapshot?.planItems?.length ?? 0
      })
      phaseRef.current = phase
      phaseStartRef.current = now
      if (phase === 'ready') {
        abandonTracked.current = true
      } else {
        abandonTracked.current = false
      }
    }
  }, [phase, projectId, snapshot?.crawlPages, snapshot?.keywords, snapshot?.latestDiscovery?.keywordCount, snapshot?.planItems])

  useEffect(() => {
    if (!projectId) return
    // Clear local storage artifact once we have a project
    try { if (typeof window !== 'undefined') window.localStorage.removeItem('seo-agent.onboarding.siteUrl') } catch {}
    if (phase === 'ready') {
      setTimedOut(false)
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      return
    }
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    timeoutRef.current = window.setTimeout(() => {
      setTimedOut(true)
    }, 120_000)
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [phase, projectId])

  useEffect(() => {
    if (!projectId) return
    const handle = () => {
      if (abandonTracked.current) return
      const currentPhase = phaseRef.current
      if (currentPhase === 'ready') return
      abandonTracked.current = true
      trackOnboardingEvent('onboarding_abandon', { projectId, phase: currentPhase })
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') handle()
    }
    window.addEventListener('beforeunload', handle)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('beforeunload', handle)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [projectId])

  const { crawlFeed, crawlActive, progress: crawlProgress } = useCrawlFeed(project, snapshot)
  const planSummary = usePlanSummary(snapshot)

  useEffect(() => {
    if (!projectId) return
    if (phase === 'ready' && planSummary.scheduledCount > 0) {
      const timer = window.setTimeout(() => {
        navigate({ to: '/dashboard', search: { onboarding: 'done' }, replace: true })
      }, 1200)
      return () => window.clearTimeout(timer)
    }
  }, [phase, planSummary.scheduledCount, navigate, projectId])

  if (!projectId) {
    if (import.meta.env.DEV) {
      console.info('[onboarding.screen] no projectId view', {
        projectSlug,
        siteUrl,
        hasSession: Boolean(session?.user)
      })
    }
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 px-6 py-24 text-center">
        <Badge variant="outline" className="border-primary/40 text-primary">State: url_required</Badge>
        <Sparkles className="h-10 w-10 text-primary" />
        <h1 className="text-3xl font-semibold">Let’s start by adding a website</h1>
        <p className="text-sm text-muted-foreground">
          {session?.user?.email
            ? `Hi ${session.user.name?.split(' ')[0] || session.user.email}, drop in ${siteUrl ?? projectSlug ?? 'your domain'} on the home page to kick off the crawl, keyword discovery, and content plan.`
            : projectSlug || siteUrl
              ? 'Finish signing in so we can continue setting up your new project.'
              : 'Enter your domain on the home page to trigger the crawl, keyword discovery, and content plan.'}
        </p>
        <button
          type="button"
          onClick={() => navigate({ to: '/' })}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90"
        >
          Return home
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    )
  }

  const steps = buildSteps({
    phase,
    phaseIndex,
    snapshot,
    crawlActive,
    crawlProgress,
    planSummary,
    keywordFeedCount: keywordFeed.length
  })

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16">
      <header className="space-y-3">
        <Badge variant="secondary" className="w-fit bg-primary/10 text-primary">
          Onboarding · {projectSlug ? projectSlug : project?.name ?? 'project'}
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Setting up your SEO Agent workspace</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          We’re crawling {project?.siteUrl ?? siteUrl ?? 'your site'}, expanding keyword coverage, and building the first 30-day publishing schedule. This page updates automatically.
        </p>
        {timedOut ? (
          <Alert className="mt-4 border-amber-300 bg-amber-50 text-amber-900">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Taking longer than usual</AlertTitle>
            <AlertDescription>
              We’re still crunching data for this domain. You can keep this page open or jump to the dashboard to monitor jobs directly.
              <div className="mt-3 inline-flex gap-3">
                <Link
                  to="/dashboard"
                  className="text-sm font-medium text-primary underline-offset-2 hover:underline"
                  search={{ onboarding: 'pending' }}
                >
                  Go to dashboard
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setTimedOut(false)
                    if (projectId) {
                      trackOnboardingEvent('onboarding_phase_change', {
                        projectId,
                        phase: phaseRef.current,
                        retry: true
                      })
                    }
                  }}
                  className="text-sm font-medium text-muted-foreground underline-offset-2 hover:underline"
                >
                  Keep waiting
                </button>
              </div>
            </AlertDescription>
          </Alert>
        ) : null}
      </header>

      <section className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
        <div className="space-y-4">
          <ol className="space-y-4">
            {steps.map((step) => (
              <li key={step.id} className="rounded-xl border bg-card p-5 shadow-sm">
                <div className="flex items-start gap-4">
                  <StatusIcon status={step.status} />
                  <div className="flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-foreground">{step.title}</h2>
                      {step.badge ? <Badge variant="outline" className="border-primary/50 text-xs text-primary">{step.badge}</Badge> : null}
                    </div>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                    {step.metric ? <p className="text-xs text-muted-foreground">{step.metric}</p> : null}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="space-y-5">
          <CrawlCard feed={crawlFeed} active={crawlActive} siteUrl={project?.siteUrl ?? ''} progress={crawlProgress} />
          <KeywordCard feed={keywordFeed} phase={phase} />
          <PlanCard summary={planSummary} phase={phase} projectId={projectId} />
        </div>
      </section>
    </div>
  )
}

function buildSteps(params: {
  phase: OnboardingPhase
  phaseIndex: number
  snapshot: ProjectSnapshot | null
  crawlActive: boolean
  crawlProgress: { percent: number; completed: number; target: number }
  keywordFeedCount: number
  planSummary: ReturnType<typeof usePlanSummary>
}) {
  const { phase, phaseIndex, snapshot, crawlActive, crawlProgress, keywordFeedCount, planSummary } = params
  const crawlCount = snapshot?.crawlPages?.length ?? 0
  const keywordCount = snapshot?.latestDiscovery?.keywordCount ?? snapshot?.keywords?.length ?? keywordFeedCount
  const totalPlan = snapshot?.planItems?.length ?? planSummary.totalCount
  const repsCount = Array.isArray((snapshot as any)?.representatives) ? ((snapshot as any).representatives as string[]).length : 0

  return [
    {
      id: 'sitemap',
      title: 'Process sitemap',
      description: 'Load sitemap and rank top 100 representative URLs.',
      status: deriveStepStatus(phaseIndex, PHASES.indexOf('sitemap')),
      metric: repsCount > 0 ? `${repsCount} selected` : undefined,
      badge: repsCount > 0 ? 'Complete' : phaseIndex === PHASES.indexOf('sitemap') ? 'In progress' : undefined
    },
    {
      id: 'crawl',
      title: 'Crawling your website',
      description: 'Fetching the selected URLs and extracting content.',
      status: deriveStepStatus(phaseIndex, PHASES.indexOf('crawling')),
      metric:
        crawlCount > 0
          ? `${crawlCount} pages discovered`
          : crawlActive
            ? `${Math.min(crawlProgress.completed, crawlProgress.target)} / ${crawlProgress.target} pages`
            : undefined,
      badge: crawlActive ? 'In progress' : crawlCount > 0 ? 'Complete' : undefined
    },
    {
      id: 'keywords',
      title: 'Generating high-impact keywords',
      description: 'Combining SERP data, competitor gaps, and embeddings to rank opportunities.',
      status: deriveStepStatus(phaseIndex, PHASES.indexOf('keywording')),
      metric: keywordCount > 0 ? `${keywordCount} keywords sourced` : undefined,
      badge: keywordCount > 0 && phaseIndex <= PHASES.indexOf('keywording') ? 'Seeding strategy' : undefined
    },
    {
      id: 'plan',
      title: 'Building your 30-day publishing plan',
      description: 'Prioritizing drafts, scheduling daily posts, and prepping outlines.',
      status: deriveStepStatus(phaseIndex, PHASES.indexOf('planning')),
      metric:
        planSummary.totalCount > 0
          ? `${planSummary.totalCount} drafts outlined · ${planSummary.scheduledCount} scheduled`
          : undefined,
      badge: planSummary.nextPublishLabel
    }
  ]
}

function deriveStepStatus(currentPhaseIndex: number, stepPhaseIndex: number): 'done' | 'active' | 'pending' {
  if (currentPhaseIndex > stepPhaseIndex) return 'done'
  if (currentPhaseIndex === stepPhaseIndex) return 'active'
  return 'pending'
}

function StatusIcon({ status }: { status: 'done' | 'active' | 'pending' }) {
  if (status === 'done') return <CheckCircle2 className="mt-1 h-5 w-5 text-emerald-500" />
  if (status === 'active') return <Loader2 className="mt-1 h-5 w-5 animate-spin text-primary" />
  return <Circle className="mt-1 h-5 w-5 text-muted-foreground" />
}

function CrawlCard({
  feed,
  active,
  siteUrl,
  progress
}: {
  feed: CrawlFeedItem[]
  active: boolean
  siteUrl: string
  progress: { percent: number; completed: number; target: number }
}) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Crawling sitemap</h3>
          <p className="text-xs text-muted-foreground">{siteUrl ? `Scanning ${siteUrl}` : 'Discovering site structure'}</p>
        </div>
        <Badge variant={active ? 'secondary' : 'outline'} className={cn('text-xs', active ? 'bg-primary/10 text-primary' : 'text-muted-foreground')}>
          {active ? 'In progress' : 'Live data'}
        </Badge>
      </div>
      <div className="mt-4">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>
            {progress.target > 0
              ? `${Math.min(progress.completed, progress.target)} / ${progress.target} pages`
              : 'Discovering site structure…'}
          </span>
          <span className="font-medium text-foreground">{progress.percent}%</span>
        </div>
        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.min(progress.percent, 100)}%` }}
          />
        </div>
      </div>
      <div className="mt-4 space-y-1.5">
        {feed.slice(-MAX_FEED_ITEMS).map((item, idx) => (
          <div
            key={`${item.url}-${idx}`}
            className="flex items-center justify-between rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-xs font-mono"
          >
            <span className="truncate text-muted-foreground">{item.url}</span>
            <span
              className={cn(
                'ml-3 shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide',
                item.status === 'complete'
                  ? 'bg-emerald-100 text-emerald-700'
                  : item.status === 'failed'
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-primary/10 text-primary'
              )}
            >
              {item.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

type KeywordFeedItem = {
  phrase: string
  searchVolume?: number | null
  difficulty?: number | null
}

function KeywordCard({ feed, phase }: { feed: KeywordFeedItem[]; phase: OnboardingPhase }) {
  const hasData = feed.length > 0
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Keyword signals</h3>
          <p className="text-xs text-muted-foreground">High-volume topics you can win quickly.</p>
        </div>
        <Badge variant={phase === 'keywording' ? 'secondary' : 'outline'} className={cn('text-xs', phase === 'keywording' ? 'bg-primary/10 text-primary' : 'text-muted-foreground')}>
          {phase === 'keywording' ? 'Updating' : hasData ? 'Ranked' : 'Queued'}
        </Badge>
      </div>
      <div className="mt-4 space-y-2">
        {feed.slice(-MAX_FEED_ITEMS).map((item, idx) => (
          <div key={`${item.phrase}-${idx}`} className="flex items-center justify-between rounded-lg border border-border/60 bg-background/60 px-3 py-2">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">{item.phrase}</span>
              <span className="text-[11px] text-muted-foreground">
                SV {formatMetric(item.searchVolume)} · Difficulty {formatMetric(item.difficulty)}
              </span>
            </div>
          </div>
        ))}
        {!hasData ? (
          <p className="text-xs text-muted-foreground">Generating SERP-backed keyword opportunities…</p>
        ) : null}
      </div>
    </div>
  )
}

function PlanCard({
  summary,
  phase,
  projectId
}: {
  summary: ReturnType<typeof usePlanSummary>
  phase: OnboardingPhase
  projectId: string | null
}) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">Publishing schedule</h3>
          <p className="text-xs text-muted-foreground">Your first month of articles, queued automatically.</p>
        </div>
        <Badge variant={phase === 'ready' ? 'secondary' : 'outline'} className={cn('text-xs', phase === 'ready' ? 'bg-emerald-100 text-emerald-700' : 'text-muted-foreground')}>
          {phase === 'ready' ? 'Ready' : 'Drafting' }
        </Badge>
      </div>
      <div className="mt-4 space-y-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          {summary.totalCount > 0 ? `${summary.totalCount} drafts outlined` : 'Generating outlines…'}
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          {summary.scheduledCount > 0 && summary.nextPublishLabel
            ? `First article publishes ${summary.nextPublishLabel}`
            : 'Scheduling daily posts…'}
        </div>
        {summary.nextPublishTitle ? (
          <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3 text-xs text-primary/80">
            Next up: <span className="font-semibold text-primary">{summary.nextPublishTitle}</span>
          </div>
        ) : null}
        {phase === 'ready' ? (
          <div className="rounded-lg border border-border/60 bg-background/80 p-3 text-xs">
            Next step: connect your CMS for auto-publishing.
            <Link to="/integrations" className="ml-2 font-semibold text-primary underline-offset-2 hover:underline">
              Open integrations
            </Link>
          </div>
        ) : null}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <Link
          to="/articles"
          search={projectId ? { project: projectId } : undefined}
          className="inline-flex items-center gap-2 text-sm font-medium text-primary transition hover:underline"
        >
          View content plan
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          to="/dashboard"
          search={{ onboarding: 'done' }}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-primary"
        >
          Skip to dashboard
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}

function useCrawlFeed(project: Project | null, snapshot: ProjectSnapshot | null) {
  const baseUrl = project?.siteUrl ?? null
  const placeholders = useMemo(() => buildPlaceholderCrawl(baseUrl), [baseUrl])
  const [feed, setFeed] = useState<CrawlFeedItem[]>(() =>
    placeholders.slice(0, Math.min(4, placeholders.length)).map((url, index) => ({
      url,
      status: (index === 0 ? 'pending' : 'queued') as CrawlFeedItem['status']
    }))
  )
  const hasReal = (snapshot?.crawlPages?.length ?? 0) > 0

  useEffect(() => {
    if (hasReal) return
    setFeed(
      placeholders.slice(0, Math.min(4, placeholders.length)).map((url, index) => ({
        url,
        status: (index === 0 ? 'pending' : 'queued') as CrawlFeedItem['status']
      }))
    )
  }, [placeholders, hasReal])

  useEffect(() => {
    if (!hasReal) return
    const real = buildRealCrawl(snapshot?.crawlPages ?? [], baseUrl)
    if (real.length) setFeed(real.slice(-MAX_FEED_ITEMS))
  }, [hasReal, snapshot?.crawlPages, baseUrl])

  useEffect(() => {
    if (hasReal) return
    let idx = 0
    let timer: number | undefined
    let cancelled = false
    const tick = () => {
      if (cancelled) return
      const next = placeholders.length ? placeholders[idx % placeholders.length] : `/${idx + 1}`
      idx += 1
      setFeed((prev) => {
        const updated = prev.map((entry, entryIdx) =>
          entryIdx === prev.length - 1 ? { ...entry, status: 'complete' as CrawlFeedItem['status'] } : entry
        )
        const merged = [...updated, { url: next, status: 'pending' as CrawlFeedItem['status'] }]
        if (merged.length > MAX_FEED_ITEMS) return merged.slice(-MAX_FEED_ITEMS)
        return merged
      })
      timer = window.setTimeout(tick, 300 + Math.random() * 200)
    }
    timer = window.setTimeout(tick, 220)
    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
    }
  }, [hasReal, placeholders])

  const crawlCount = snapshot?.crawlPages?.length ?? 0
  const repsCount = Array.isArray((snapshot as any)?.representatives) ? ((snapshot as any).representatives as string[]).length : null
  const targetBaseline = repsCount && repsCount > 0 ? repsCount : (project?.crawlBudget ?? 20)
  const target = hasReal ? Math.max(targetBaseline, crawlCount || targetBaseline) : Math.max(targetBaseline, feed.length || 1)
  const completed = hasReal ? crawlCount : feed.filter((entry) => entry.status === 'complete').length
  const percent = target > 0 ? Math.min(100, Math.round((completed / target) * 100)) : 0

  return {
    crawlFeed: feed,
    crawlActive: !hasReal,
    progress: { percent, completed, target }
  }
}

function useKeywordFeed(project: Project | null, snapshot: ProjectSnapshot | null): KeywordFeedItem[] {
  const placeholders = useMemo(
    () => buildPlaceholderKeywords(project?.name ?? project?.siteUrl ?? ''),
    [project?.name, project?.siteUrl]
  )
  // Stabilize reference: avoid [] literal recreating on every render when undefined
  const snapshotKeywords: Keyword[] = useMemo(() => {
    const arr = (snapshot?.keywords as Keyword[] | undefined) ?? []
    return arr
  }, [snapshot?.keywords])
  const hasReal = snapshotKeywords.length > 0
  const initial = hasReal
    ? snapshotKeywords.map(mapKeyword).slice(0, MAX_FEED_ITEMS)
    : placeholders.slice(0, Math.min(4, placeholders.length))
  const [feed, setFeed] = useState<KeywordFeedItem[]>(initial)

  useEffect(() => {
    if (hasReal) {
      const mapped = snapshotKeywords.map(mapKeyword).slice(0, MAX_FEED_ITEMS)
      setFeed(mapped)
    } else {
      setFeed(placeholders.slice(0, Math.min(4, placeholders.length)))
    }
  }, [hasReal, placeholders, snapshotKeywords])

  useEffect(() => {
    if (hasReal) return
    let idx = placeholders.length
    let timer: number | undefined
    let cancelled = false
    const tick = () => {
      if (cancelled) return
      const next = placeholders.length ? placeholders[idx % placeholders.length] : { phrase: `keyword idea ${idx + 1}` }
      idx += 1
      setFeed((prev) => {
        const merged = [...prev, next]
        if (merged.length > MAX_FEED_ITEMS) return merged.slice(-MAX_FEED_ITEMS)
        return merged
      })
      timer = window.setTimeout(tick, 320 + Math.random() * 220)
    }
    timer = window.setTimeout(tick, 260)
    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
    }
  }, [hasReal, placeholders])

  return feed
}

function mapKeyword(kw: Keyword): KeywordFeedItem {
  return {
    phrase: kw.phrase,
    searchVolume: kw.metricsJson?.searchVolume ?? null,
    difficulty: kw.metricsJson?.difficulty ?? null
  }
}

function usePlanSummary(snapshot: ProjectSnapshot | null) {
  return useMemo(() => {
    const planItems = snapshot?.planItems ?? []
    const totalCount = planItems.length
    const scheduled = planItems.filter((item) => isScheduled(item.status))
    const scheduledCount = scheduled.length
    const drafts = totalCount - scheduledCount
    const next = scheduled
      .map((item) => ({ item, date: toDate(item.plannedDate) }))
      .filter((entry) => entry.date)
      .sort((a, b) => a.date!.getTime() - b.date!.getTime())[0]

    return {
      totalCount,
      scheduledCount,
      draftCount: drafts,
      nextPublishLabel: next?.date ? formatDate(next.date) : null,
      nextPublishTitle: next?.item?.title ?? null
    }
  }, [snapshot?.planItems])
}

function isScheduled(status: PlanItem['status']): boolean {
  const value = (status ?? '').toLowerCase()
  return value === 'scheduled' || value === 'published'
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function formatDate(date: Date) {
  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
}

function formatMetric(value: number | null | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—'
  if (value >= 1000) return Math.round(value).toLocaleString()
  if (value >= 100) return Math.round(value).toString()
  return value.toFixed(0)
}

function derivePhase(snapshot: ProjectSnapshot | null, fallbackKeywordCount = 0): OnboardingPhase {
  if (!snapshot) return 'initializing'
  const planItems = snapshot.planItems ?? []
  const scheduledExists = planItems.some((item) => isScheduled(item.status))
  if (scheduledExists) return 'ready'
  if (planItems.length > 0) return 'planning'
  const keywordCount = snapshot.latestDiscovery?.keywordCount ?? snapshot.keywords?.length ?? fallbackKeywordCount
  if (keywordCount > 0) return 'keywording'
  const crawlCount = snapshot.crawlPages?.length ?? 0
  const repsCount = Array.isArray((snapshot as any)?.representatives) ? ((snapshot as any).representatives as string[]).length : 0
  if (crawlCount > 0) return 'crawling'
  if (repsCount > 0) return 'sitemap'
  return 'initializing'
}

function buildPlaceholderCrawl(siteUrl: string | null) {
  const host = siteUrl ? extractHost(siteUrl) : 'your-site.com'
  const base = `https://${host}`
  return [
    `${base}/`,
    `${base}/about`,
    `${base}/pricing`,
    `${base}/blog`,
    `${base}/blog/ai-seo-checklist`,
    `${base}/blog/programmatic-seo`,
    `${base}/resources/templates`,
    `${base}/case-studies/traffic-lift`,
    `${base}/integrations`,
    `${base}/contact`
  ]
}

function buildRealCrawl(pages: ProjectSnapshot['crawlPages'] | undefined, baseUrl: string | null): CrawlFeedItem[] {
  const seen = new Set<string>()
  const list: CrawlFeedItem[] = []
  for (const page of pages ?? []) {
    const display = formatUrl(page.url, baseUrl)
    if (!display || seen.has(display)) continue
    seen.add(display)
    list.push({ url: display, status: mapCrawlStatus(page.status) })
    if (list.length >= MAX_FEED_ITEMS) break
  }
  return list
}

function mapCrawlStatus(status: string | null | undefined): CrawlFeedItem['status'] {
  const value = (status ?? '').toLowerCase()
  if (value === 'completed') return 'complete'
  if (value === 'failed') return 'failed'
  if (value === 'in_progress') return 'pending'
  return 'queued'
}

function formatUrl(url: string, baseUrl: string | null) {
  if (!url) return null
  try {
    const parsed = new URL(url, baseUrl || undefined)
    return `${parsed.origin}${parsed.pathname.replace(/\/$/, '') || '/'}`
  } catch {
    return url
  }
}

function extractHost(url: string) {
  try {
    const parsed = new URL(url)
    return parsed.hostname
  } catch {
    return url.replace(/^https?:\/\//, '')
  }
}

function buildPlaceholderKeywords(seed: string) {
  const base = seed && seed.length ? seed : 'seo agent'
  return [
    { phrase: `${base} ai strategy`, searchVolume: 540, difficulty: 28 },
    { phrase: `${base} long tail keywords`, searchVolume: 420, difficulty: 35 },
    { phrase: `${base} content automation`, searchVolume: 360, difficulty: 32 },
    { phrase: `${base} programmatic seo`, searchVolume: 290, difficulty: 41 },
    { phrase: `${base} topical map`, searchVolume: 170, difficulty: 27 },
    { phrase: `${base} serp outline`, searchVolume: 150, difficulty: 30 },
    { phrase: `${base} autopublish`, searchVolume: 120, difficulty: 26 },
    { phrase: `${base} blog ideas`, searchVolume: 90, difficulty: 22 }
  ]
}
