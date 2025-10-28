import { useMemo } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { LayoutDashboard, SquareStack, FileText, CalendarRange, RefreshCcw } from 'lucide-react'

import type { DashboardNavGroup, DashboardUserSummary } from '@blocks/dashboard/dashboard-shell'
import { DashboardShell } from '@blocks/dashboard/dashboard-shell'
import type { MeSession } from '@entities'
import { fetchSession } from '@entities/org/service'
import { listProjects } from '@entities/project/service'

export function DashboardScreen(): JSX.Element {
  const { data, isLoading } = useQuery<MeSession>({
    queryKey: ['me'],
    queryFn: fetchSession
  })

  const user = data?.user ?? null
  const activeOrg = data?.activeOrg ?? null
  const entitlements = data?.entitlements ?? null

  const projectsQuery = useQuery<{ items: any[] }>({
    queryKey: ['projects', activeOrg?.id ?? 'none'],
    queryFn: () => listProjects(activeOrg?.id),
    enabled: Boolean(activeOrg?.id)
  })
  const firstProjectId = (projectsQuery.data?.items?.[0]?.id as string | undefined) || undefined

  const upgradeMutation = useMutation({
    mutationFn: async () => {
      if (!activeOrg) {
        throw new Error('No organization selected')
      }
      const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'
      const payload = {
        orgId: activeOrg.id,
        plan: 'growth',
        successUrl: `${origin}/dashboard?billing=success`,
        cancelUrl: `${origin}/dashboard?billing=cancel`
      }
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      })
      if (!response.ok) {
        throw new Error('Failed to create checkout session')
      }
      const result = (await response.json()) as { url: string }
      return result.url
    },
    onSuccess: (url) => {
      if (typeof window !== 'undefined') {
        window.location.href = url
      }
    }
  })

  const portalMutation = useMutation({
    mutationFn: async () => {
      if (!activeOrg) {
        throw new Error('No organization selected')
      }
      const params = new URLSearchParams()
      params.set('orgId', activeOrg.id)
      if (typeof window !== 'undefined') {
        params.set('returnUrl', `${window.location.origin}/dashboard`)
      }
      const response = await fetch(`/api/billing/portal?${params.toString()}`, {
        method: 'GET',
        credentials: 'include'
      })
      if (!response.ok) {
        throw new Error('Failed to load portal link')
      }
      const result = (await response.json()) as { url: string }
      return result.url
    },
    onSuccess: (url) => {
      if (typeof window !== 'undefined') {
        window.open(url, '_blank', 'noopener,noreferrer')
      }
    }
  })

  const navGroups = useMemo<DashboardNavGroup[]>(() => {
    const items: DashboardNavGroup[] = [
      {
        key: 'workspace',
        label: 'Workspace',
        items: [
          { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, active: true, element: <Link to="/dashboard" /> },
          { key: 'projects', label: 'Projects', icon: SquareStack, element: <Link to="/projects" /> }
        ]
      },
      {
        key: 'project',
        label: 'Project',
        items: [
          { key: 'project-home', label: 'Project', icon: SquareStack, element: <Link to="/projects" /> },
          { key: 'switch-project', label: 'Switch active project', icon: RefreshCcw, element: <Link to="/projects" /> }
        ]
      }
    ]
    // Deep links to first project if present (keywords/calendar tabs)
    try {
      if (firstProjectId) {
        items.push({
          key: 'shortcuts',
          label: 'Shortcuts',
          items: [
            { key: 'keywords', label: 'Keywords', icon: FileText, element: <Link to={`/projects/${firstProjectId}`} search={{ tab: 'keywords' }} /> },
            { key: 'calendar', label: 'Content calendar', icon: CalendarRange, element: <Link to={`/projects/${firstProjectId}`} search={{ tab: 'plan' }} /> }
          ]
        })
      }
    } catch {}
    return items
  }, [firstProjectId])

  const topAction = user ? (
    <Link to="/projects" className="text-sm font-medium text-primary hover:underline">
      View projects
    </Link>
  ) : isLoading ? (
    <span className="text-xs text-muted-foreground">Loading account…</span>
  ) : (
    <a href="/login" className="text-sm font-medium text-primary hover:underline">
      Sign in
    </a>
  )

  return (
    <DashboardShell
      title="Dashboard"
      subtitle="Monitor crawls, planning, and publishing progress once projects are connected."
      actions={topAction}
      nav={navGroups}
      user={normalizeUser(user)}
    >
      <div className="grid gap-6">
        <EmptyProjectsCallout />
        <BillingSummaryCard
          activeOrg={activeOrg}
          entitlements={entitlements}
          onUpgrade={() => upgradeMutation.mutate()}
          onOpenPortal={() => portalMutation.mutate()}
          disableUpgrade={!activeOrg || upgradeMutation.isPending}
          disablePortal={!activeOrg || portalMutation.isPending}
          upgradePending={upgradeMutation.isPending}
          portalPending={portalMutation.isPending}
        />
      </div>
    </DashboardShell>
  )
}

function normalizeUser(user: MeSession['user'] | null): DashboardUserSummary | null {
  if (!user) return null
  return { name: user.name, email: user.email }
}

type EmptyProjectsCalloutProps = {
  message?: string
}

function EmptyProjectsCallout({ message }: EmptyProjectsCalloutProps = {}) {
  return (
    <section className="rounded-lg border border-dashed bg-muted/30 p-8 text-center">
      <h2 className="text-xl font-semibold">No projects yet</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {message ??
          'Create your first project to start crawling a site and building the 30-day content plan.'}
      </p>
      <div className="mt-6 flex justify-center">
        <Link
          to="/projects"
          className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          Create project
        </Link>
      </div>
    </section>
  )
}

type BillingSummaryCardProps = {
  activeOrg: MeSession['activeOrg'] | null | undefined
  entitlements: MeSession['entitlements'] | null | undefined
  onUpgrade: () => void
  onOpenPortal: () => void
  disableUpgrade: boolean
  disablePortal: boolean
  upgradePending: boolean
  portalPending: boolean
}

function BillingSummaryCard({
  activeOrg,
  entitlements,
  onUpgrade,
  onOpenPortal,
  disableUpgrade,
  disablePortal,
  upgradePending,
  portalPending
}: BillingSummaryCardProps) {
  const quotaText = activeOrg
    ? `Current plan: ${activeOrg.plan}. Projects: ${entitlements?.projectQuota ?? 0}, articles/day: ${entitlements?.dailyArticles ?? 0}.`
    : 'Connect an organization to manage billing.'

  return (
    <section className="rounded-lg border bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Plan &amp; Billing</h2>
          <p className="text-sm text-muted-foreground">{quotaText}</p>
        </div>
        <div className="flex flex-col gap-2 md:flex-row">
          <button
            type="button"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={disableUpgrade}
            onClick={onUpgrade}
          >
            {upgradePending ? 'Redirecting…' : 'Upgrade Plan'}
          </button>
          <button
            type="button"
            className="rounded-md border border-input px-4 py-2 text-sm font-medium transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={disablePortal}
            onClick={onOpenPortal}
          >
            {portalPending ? 'Opening…' : 'Open Billing Portal'}
          </button>
        </div>
      </div>
    </section>
  )
}
