// @ts-nocheck
// @ts-nocheck
import { useMemo } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import type { MeResponse } from '@seo-agent/domain'

export const Route = createFileRoute('/dashboard')({
  component: DashboardPage
})

function DashboardPage() {
  const { data, isLoading } = useQuery<MeResponse>({
    queryKey: ['me'],
    queryFn: async () => {
      const response = await fetch('/api/me', {
        method: 'GET',
        credentials: 'include'
      })
      if (!response.ok) {
        throw new Error('Failed to load session')
      }
      return (await response.json()) as MeResponse
    }
  })

  const user = data?.user ?? null
  const activeOrg = data?.activeOrg ?? null
  const entitlements = data?.entitlements ?? null

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
  const initials = useMemo(() => {
    if (!user) return ''
    const parts = user.name?.split(' ').filter(Boolean)
    if (!parts || parts.length === 0) {
      return user.email.slice(0, 2).toUpperCase()
    }
    return parts.length === 1
      ? parts[0]!.slice(0, 2).toUpperCase()
      : `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase()
  }, [user])

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-6 py-12">
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Monitor crawls, plans, and publishing progress once projects are connected.
            </p>
          </div>
          <Link
            to="/projects"
            className="text-sm font-medium text-primary hover:underline"
          >
            View projects
          </Link>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <div className="text-right">
                  <p className="text-sm font-medium">{user.name || user.email}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {user.imageUrl ? (
                    <img
                      src={user.imageUrl}
                      alt={user.name ?? user.email}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    initials
                  )}
                </div>
              </>
            ) : isLoading ? (
              <span className="text-xs text-muted-foreground">Loading profile...</span>
            ) : (
              <a
                href="/login"
                className="text-sm font-medium text-primary hover:underline"
              >
                Sign in
              </a>
            )}
          </div>
        </div>
      </header>
      <section className="rounded-lg border border-dashed bg-muted/30 p-8 text-center">
        <h2 className="text-xl font-semibold">No projects yet</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Create your first project to start crawling a site and building the 30-day content plan.
        </p>
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            Create project
          </button>
        </div>
      </section>
      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Plan &amp; Billing</h2>
            <p className="text-sm text-muted-foreground">
              {activeOrg
                ? `Current plan: ${activeOrg.plan}. Projects: ${entitlements?.projectQuota ?? 0}, articles/day: ${entitlements?.dailyArticles ?? 0}.`
                : 'Connect an organization to manage billing.'}
            </p>
          </div>
          <div className="flex flex-col gap-2 md:flex-row">
            <button
              type="button"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!activeOrg || upgradeMutation.isPending}
              onClick={() => upgradeMutation.mutate()}
            >
              {upgradeMutation.isPending ? 'Redirecting…' : 'Upgrade Plan'}
            </button>
            <button
              type="button"
              className="rounded-md border border-input px-4 py-2 text-sm font-medium transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!activeOrg || portalMutation.isPending}
              onClick={() => portalMutation.mutate()}
            >
              {portalMutation.isPending ? 'Opening…' : 'Open Billing Portal'}
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}
