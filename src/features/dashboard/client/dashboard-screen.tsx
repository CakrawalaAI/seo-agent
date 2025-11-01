import { useMutation, useQuery } from '@tanstack/react-query'
import { Button } from '@src/common/ui/button'
import type { MeSession } from '@entities'
import { fetchSession } from '@entities/org/service'
import { PipelineTimelineCard } from './pipeline-timeline'
import { getPlanItems, getProjectArticles, getProjectKeywords } from '@entities/project/service'

export function DashboardScreen(): JSX.Element {
  const { data } = useQuery<MeSession>({ queryKey: ['me'], queryFn: fetchSession })
  const activeOrg = data?.activeOrg ?? null
  const entitlements = data?.entitlements ?? null
  const usage = data?.usage ?? null
  const activeProjectId = (data as any)?.activeProjectId ?? null

  const subscribeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({})
      })
      if (res.status === 302) {
        const location = res.headers.get('Location')
        if (location && typeof window !== 'undefined') window.location.href = location
        return null
      }
      if (res.ok) {
        // Fallback: if backend ever returns JSON URL
        const data = (await res.json().catch(() => ({}))) as any
        const url = data?.url
        if (url && typeof window !== 'undefined') window.location.href = url
      }
      return null
    }
  })

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/billing/portal', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}) })
      if (!res.ok) return null
      const data = (await res.json().catch(() => ({}))) as any
      const url = data?.url
      if (url && typeof window !== 'undefined') window.location.href = url
      return null
    }
  })

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Monitor crawls, planning, and publishing progress once projects are connected.
        </p>
      </header>
      <div className="grid gap-6">
        <BillingSummaryCard
          activeOrg={activeOrg}
          entitlements={entitlements}
          onSubscribe={() => subscribeMutation.mutate()}
          onOpenPortal={() => portalMutation.mutate()}
          disableSubscribe={!activeOrg || subscribeMutation.isPending}
          disablePortal={!activeOrg || portalMutation.isPending}
          subscribePending={subscribeMutation.isPending}
          portalPending={portalMutation.isPending}
          usage={usage}
        />
        {activeProjectId ? (
          <>
            <ProjectSummaryCard projectId={activeProjectId} />
            <PipelineTimelineCard projectId={activeProjectId} />
          </>
        ) : (
          <section className="rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Project Pipeline</h2>
            <p className="text-sm text-muted-foreground mt-1">Create a project to view onboarding phases and progress.</p>
          </section>
        )}
      </div>
    </div>
  )
}

function ProjectSummaryCard({ projectId }: { projectId: string }) {
  const keywordsQ = useQuery({
    queryKey: ['dash.keywords', projectId],
    queryFn: async () => (await getProjectKeywords(projectId, 1000)).items,
    refetchInterval: 10000
  })
  const articlesQ = useQuery({
    queryKey: ['dash.articles', projectId],
    queryFn: async () => (await getProjectArticles(projectId, 300)).items,
    refetchInterval: 10000
  })
  const planQ = useQuery({
    queryKey: ['dash.plan', projectId],
    queryFn: async () => (await getPlanItems(projectId, 120)).items,
    refetchInterval: 15000
  })

  const keywords = keywordsQ.data || []
  const articles = articlesQ.data || []
  const plan = planQ.data || []
  const published = articles.filter((a: any) => a.status === 'published').length
  const drafts = articles.filter((a: any) => a.status !== 'published').length
  const todayYmd = new Date().toISOString().slice(0, 10)
  const scheduled = plan.filter((p: any) => typeof p.plannedDate === 'string' && p.plannedDate >= todayYmd).length

  return (
    <section className="rounded-lg border bg-card p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Project Summary</h2>
      <p className="text-sm text-muted-foreground">Key counts for the active project</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Keywords" value={keywords.length} />
        <Stat label="Drafts" value={drafts} />
        <Stat label="Published" value={published} />
        <Stat label="Scheduled" value={scheduled} />
      </div>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  )
}

type BillingSummaryCardProps = {
  activeOrg: MeSession['activeOrg'] | null | undefined
  entitlements: MeSession['entitlements'] | null | undefined
  onSubscribe: () => void
  onOpenPortal: () => void
  disableSubscribe: boolean
  disablePortal: boolean
  subscribePending: boolean
  portalPending: boolean
  usage: MeSession['usage'] | null | undefined
}

function BillingSummaryCard({
  activeOrg,
  entitlements,
  onSubscribe,
  onOpenPortal,
  disableSubscribe,
  disablePortal,
  subscribePending,
  portalPending,
  usage
}: BillingSummaryCardProps) {
  const total = Number(entitlements?.monthlyPostCredits || usage?.monthlyPostCredits || 0)
  const used = Number(usage?.postsUsed || 0)
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0
  const quotaText = activeOrg
    ? `Posts this month: ${used}/${total > 0 ? total : '∞'}`
    : 'Connect an organization to manage billing.'

  return (
    <section className="rounded-lg border bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Plan &amp; Billing</h2>
          <p className="text-sm text-muted-foreground">{quotaText}</p>
          {total > 0 ? (
            <div className="mt-3 h-2 w-64 rounded bg-muted">
              <div className="h-2 rounded bg-primary" style={{ width: `${pct}%` }} />
            </div>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 md:flex-row">
          <Button
            type="button"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={disableSubscribe}
            onClick={onSubscribe}
          >
            {subscribePending ? 'Redirecting…' : 'Subscribe'}
          </Button>
          <Button
            type="button"
            className="rounded-md border border-input px-4 py-2 text-sm font-medium transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={disablePortal}
            onClick={onOpenPortal}
          >
            {portalPending ? 'Opening…' : 'Open Billing Portal'}
          </Button>
        </div>
      </div>
    </section>
  )
}
