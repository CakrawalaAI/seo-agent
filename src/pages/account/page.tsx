import { useQuery, useMutation } from '@tanstack/react-query'
import { useMockData } from '@common/dev/mock-data-context'
import { fetchSession } from '@entities/org/service'
import type { MeSession } from '@entities'
import { Button } from '@src/common/ui/button'
import { Badge } from '@src/common/ui/badge'
import { Separator } from '@src/common/ui/separator'

const MOCK_SESSION: MeSession = {
  user: { name: 'Radja Polem', email: 'radja@example.com' },
  activeOrg: { id: 'org_mock', plan: 'growth' },
  entitlements: { projectQuota: 5, monthlyPostCredits: 30, dailyArticles: 2 },
  usage: { postsUsed: 8, monthlyPostCredits: 30, cycleStart: new Date().toISOString() },
  orgs: [{ id: 'org_mock', name: 'Prep Interview', plan: 'growth' }],
  activeProjectId: 'proj_mock'
}

export function Page(): JSX.Element {
  const { enabled: mockEnabled } = useMockData()

  const sessionQuery = useQuery({
    queryKey: ['account.session'],
    queryFn: fetchSession,
    staleTime: 60_000,
    enabled: !mockEnabled
  })

  const session = mockEnabled ? MOCK_SESSION : sessionQuery.data

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({})
      })
      if (res.status === 302) {
        const location = res.headers.get('Location')
        if (location && typeof window !== 'undefined') window.location.href = location
        return
      }
      if (!res.ok) return
      const payload = (await res.json().catch(() => ({}))) as { url?: string }
      if (payload?.url && typeof window !== 'undefined') window.location.href = payload.url
    }
  })

  const planLabel = session?.activeOrg?.plan ? titleCase(session.activeOrg.plan) : 'No plan'
  const postsUsed = session?.usage?.postsUsed ?? 0
  const postsTotal = session?.usage?.monthlyPostCredits ?? session?.entitlements?.monthlyPostCredits ?? null
  const cycleStart = session?.usage?.cycleStart ? new Date(session.usage.cycleStart) : null

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Account</h1>
        <p className="text-sm text-muted-foreground">Manage your subscription and publishing credits.</p>
      </header>

      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="default" className="uppercase">{planLabel}</Badge>
              <span className="text-muted-foreground">Active plan</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {postsTotal ? `${postsUsed} of ${postsTotal} monthly article credits used` : `${postsUsed} articles generated this cycle`}
            </p>
            {cycleStart ? (
              <p className="text-xs text-muted-foreground">
                Cycle resets on {formatDate(addDays(cycleStart, 30))}
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (mockEnabled) return
              portalMutation.mutate()
            }}
            disabled={mockEnabled || portalMutation.isPending}
          >
            {portalMutation.isPending ? 'Opening…' : mockEnabled ? 'Mock data' : 'Open billing portal'}
          </Button>
        </div>
        <Separator className="my-4" />
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Projects</dt>
            <dd className="mt-1 font-medium text-foreground">{session?.entitlements?.projectQuota ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Daily throughput</dt>
            <dd className="mt-1 font-medium text-foreground">{session?.entitlements?.dailyArticles ?? '—'} drafts / day</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Primary email</dt>
            <dd className="mt-1 font-medium text-foreground">{session?.user?.email ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Org</dt>
            <dd className="mt-1 font-medium text-foreground">{session?.orgs?.[0]?.name ?? '—'}</dd>
          </div>
        </dl>
      </section>
    </div>
  )
}

function addDays(date: Date, days: number) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

function formatDate(date: Date) {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function titleCase(input: string) {
  return input
    .split(/[-_\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
