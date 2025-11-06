import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useRouterState } from '@tanstack/react-router'
import { useActiveWebsite } from '@common/state/active-website'
import { getWebsite, getWebsiteSnapshot } from '@entities/website/service'
import type { IntegrationStatus } from '@entities'
import { buildIntegrationViews } from '@integrations/shared/catalog'
import type { WebsiteIntegrationView } from '@integrations/shared/types'
import { extractErrorMessage, maskSecret } from '@src/common/ui/format'
import { Button } from '@src/common/ui/button'
import { Input } from '@src/common/ui/input'
import { Label } from '@src/common/ui/label'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@src/common/ui/empty'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '@src/common/ui/breadcrumb'
import { cn } from '@src/common/ui/cn'

const WEBHOOK_EVENTS: Array<{
  label: string
  description: string
  sample: Record<string, unknown>
}> = [
  {
    label: 'Article Published',
    description: 'Sent when an article is published live via webhook.',
    sample: {
      event: 'article.published',
      meta: {
        integrationId: 'int_123',
        projectId: 'proj_123',
        articleId: 'art_123',
        triggeredAt: '2025-01-01T12:00:00Z'
      },
      article: {
        title: 'How to rank #1 on Google',
        slug: 'rank-1-on-google',
        bodyHtml: '<p>Generated article body…</p>',
        excerpt: 'Generated article summary…',
        locale: 'en-US'
      }
    }
  },
  {
    label: 'Article Updated',
    description: 'Sent when an existing article is updated and re-delivered.',
    sample: {
      event: 'article.updated',
      meta: {
        integrationId: 'int_123',
        projectId: 'proj_123',
        articleId: 'art_123',
        triggeredAt: '2025-01-02T09:30:00Z'
      },
      article: {
        title: 'How to rank #1 on Google (Updated)',
        slug: 'rank-1-on-google',
        bodyHtml: '<p>Updated article body…</p>',
        excerpt: 'Updated summary…',
        locale: 'en-US'
      }
    }
  }
]

export function Page(): JSX.Element {
  const { id: activeProjectId } = useActiveWebsite()
  const routerState = useRouterState()
  const projectId = activeProjectId
  const [targetUrl, setTargetUrl] = useState('')
  const [secret, setSecret] = useState('')
  const [banner, setBanner] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [subsPublished, setSubsPublished] = useState(true)
  const [subsUpdated, setSubsUpdated] = useState(true)
  const [scheduleMode, setScheduleMode] = useState<'auto' | 'manual' | 'both'>('both')
  const [testing, setTesting] = useState(false)

  const snapshotQuery = useQuery({
    queryKey: ['integrations.snapshot', projectId],
    queryFn: () => getWebsiteSnapshot(projectId!, { cache: 'no-store' }),
    enabled: Boolean(projectId),
    refetchInterval: 45_000
  })

  const projectQuery = useQuery({
    queryKey: ['project.detail', projectId],
    queryFn: () => getWebsite(projectId!),
    enabled: Boolean(projectId)
  })

  const integrationView = useMemo<WebsiteIntegrationView | null>(() => {
    if (!snapshotQuery.data) return null
    const integrations = (snapshotQuery.data.integrationViews ?? buildIntegrationViews(snapshotQuery.data.integrations ?? [])) as WebsiteIntegrationView[]
    return integrations.find((view) => view.manifest.type === 'webhook') ?? null
  }, [snapshotQuery.data])

  useEffect(() => {
    const config = integrationView?.integration?.configJson
    const nextTarget = typeof config?.targetUrl === 'string' ? config.targetUrl : ''
    const nextSecret = typeof config?.secret === 'string' ? config.secret : ''
    setTargetUrl(nextTarget)
    setSecret(nextSecret)
    const subs = Array.isArray(config?.subscribedEvents) ? (config?.subscribedEvents as string[]) : ['article.published', 'article.updated']
    setSubsPublished(subs.includes('article.published'))
    setSubsUpdated(subs.includes('article.updated'))
    const mode = (config?.scheduleMode as any) || 'both'
    setScheduleMode(mode === 'auto' || mode === 'manual' ? mode : 'both')
  }, [integrationView?.integration?.configJson])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error('Select a project first.')
      if (!targetUrl.trim() || !secret.trim()) {
        throw new Error('Provide both Target URL and Shared Secret.')
      }
      const configPayload = { targetUrl: targetUrl.trim(), secret: secret.trim(), subscribedEvents: [subsPublished && 'article.published', subsUpdated && 'article.updated'].filter(Boolean), scheduleMode }
      if (integrationView?.id) {
        const res = await fetch(`/api/integrations/${integrationView.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ config: configPayload, status: 'connected' as IntegrationStatus })
        })
        if (!res.ok) throw new Error('Failed to save integration')
        return
      }
      const res = await fetch(`/api/integrations`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ projectId, type: 'webhook', config: configPayload, status: 'connected' as IntegrationStatus })
      })
      if (!res.ok) throw new Error('Failed to create integration')
      return
    },
    onSuccess: () => {
      setBanner({ tone: 'success', text: 'Webhook saved.' })
      snapshotQuery.refetch().catch(() => undefined)
    },
    onError: (error) => setBanner({ tone: 'error', text: extractErrorMessage(error) })
  })

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      if (!integrationView?.id) return null
      await fetch(`/api/integrations/${integrationView.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'disconnected' as IntegrationStatus }) })
    },
    onSuccess: () => {
      setBanner({ tone: 'success', text: 'Webhook disconnected.' })
      snapshotQuery.refetch().catch(() => undefined)
    },
    onError: (error) => setBanner({ tone: 'error', text: extractErrorMessage(error) })
  })

  if (!projectId) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No website selected</EmptyTitle>
            <EmptyDescription>Choose a website to configure the webhook integration.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  const isConnected = integrationView?.isActive ?? false
  const config = integrationView?.integration?.configJson
  const secretPreview = config?.secret ? maskSecret(String(config.secret)) : null
  const canMutate = Boolean(projectId)
  const projectName = projectQuery.data?.url ?? 'Website'
  const rawSearch = routerState.location.search as unknown
  const currentSearch = useMemo<Record<string, unknown>>(() => {
    if (!rawSearch) return {}
    if (rawSearch instanceof URLSearchParams) {
      const result: Record<string, string> = {}
      rawSearch.forEach((value, key) => {
        result[key] = value
      })
      return result
    }
    if (typeof rawSearch === 'object') return { ...(rawSearch as Record<string, unknown>) }
    return {}
  }, [rawSearch])

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/dashboard">Dashboard</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{projectName}</BreadcrumbPage>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/integrations" search={() => ({ ...currentSearch })}>
                Integrations
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Webhook</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Webhook Integration</h1>
        <p className="text-sm text-muted-foreground">
          Configure an HTTPS endpoint to receive PortableArticle payloads with HMAC signatures.
        </p>
      </header>

      {banner ? (
        <div
          className={cn(
            'rounded-md border px-3 py-2 text-xs',
            banner.tone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-destructive bg-destructive/10 text-destructive'
          )}
        >
          {banner.text}
        </div>
      ) : null}

      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">Connection</h2>
            <p className="text-sm text-muted-foreground">
              We deliver signed requests to your endpoint. Keep the shared secret private to verify authenticity.
            </p>
          </div>
          <StatusPill connected={isConnected} />
        </div>

        <form
          className="mt-4 grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            saveMutation.mutate()
          }}
        >
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground" htmlFor="webhook-target">
              Target URL
            </Label>
            <Input
              id="webhook-target"
              type="url"
              placeholder="https://example.com/hooks/seo-agent"
              value={targetUrl}
              onChange={(event) => setTargetUrl(event.target.value)}
              autoComplete="off"
              disabled={!canMutate}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground" htmlFor="webhook-secret">
              Shared secret
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="webhook-secret"
                type="text"
                placeholder="Generated secret"
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
                autoComplete="off"
                disabled={!canMutate}
              />
              <Button
                type="button"
                variant="outline"
                disabled={!canMutate}
                onClick={() => setSecret(genSecret())}
              >
                Generate
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={!targetUrl || !secret || saveMutation.isPending || !canMutate}>
              {saveMutation.isPending ? 'Saving…' : 'Save connection'}
            </Button>
            {isConnected && integrationView?.id ? (
              <Button
                type="button"
                variant="outline"
                disabled={disconnectMutation.isPending || !canMutate}
                onClick={() => disconnectMutation.mutate()}
              >
                {disconnectMutation.isPending ? 'Disconnecting…' : 'Disconnect'}
              </Button>
            ) : null}
            {integrationView?.id ? (
              <Button
                type="button"
                variant="outline"
                disabled={!canMutate || testing}
                onClick={async () => {
                  try {
                    setTesting(true)
                    const res = await fetch(`/api/integrations/${integrationView.id}/events/test`, { method: 'POST' })
                    if (!res.ok) throw new Error('Test failed')
                    setBanner({ tone: 'success', text: 'Test ping sent.' })
                  } catch (e) {
                    setBanner({ tone: 'error', text: 'Test failed.' })
                  } finally {
                    setTesting(false)
                  }
                }}
              >
                {testing ? 'Testing…' : 'Send test ping'}
              </Button>
            ) : null}
          </div>
        </form>

        {isConnected ? (
          <div className="mt-4 rounded-md border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
            <div>
              Target URL: <span className="font-medium text-foreground">{String(config?.targetUrl ?? '—')}</span>
            </div>
            <div>
              Shared secret: <span className="font-medium text-foreground">{secretPreview ?? '—'}</span>
            </div>
            <div>
              Subscriptions: <span className="font-medium text-foreground">{Array.isArray(config?.subscribedEvents) ? (config?.subscribedEvents as string[]).join(', ') : 'article.published, article.updated'}</span>
            </div>
            <div>
              Schedule: <span className="font-medium text-foreground">{String((config as any)?.scheduleMode || 'both')}</span>
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Event payloads</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          We currently send two event types. Verify the `X-SEOA-Signature` and `X-SEOA-Timestamp` headers before processing.
        </p>
        <div className="mt-4 grid gap-4">
          {WEBHOOK_EVENTS.map((event) => (
            <article key={event.label} className="rounded-md border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
              <header className="mb-2 font-semibold text-foreground">{event.label}</header>
              <p className="mb-3 text-xs text-muted-foreground">{event.description}</p>
              <pre className="max-h-56 overflow-auto rounded-md bg-background/80 p-3 text-[11px] leading-relaxed text-foreground">
                {JSON.stringify(event.sample, null, 2)}
              </pre>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Subscriptions</h2>
          <span className="text-xs text-muted-foreground">Choose events + schedule</span>
        </div>
        <div className="mt-4 grid gap-3">
          <div className="flex items-center gap-2 text-sm">
            <input id="evt-published" type="checkbox" className="h-4 w-4" checked={subsPublished} onChange={(e) => setSubsPublished(e.target.checked)} disabled={!canMutate} />
            <Label className="text-xs" htmlFor="evt-published">article.published</Label>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <input id="evt-updated" type="checkbox" className="h-4 w-4" checked={subsUpdated} onChange={(e) => setSubsUpdated(e.target.checked)} disabled={!canMutate} />
            <Label className="text-xs" htmlFor="evt-updated">article.updated</Label>
          </div>
          <div className="mt-2 grid gap-2">
            <Label className="text-xs text-muted-foreground">Deliver on</Label>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <label className="inline-flex items-center gap-2">
                <input type="radio" name="scheduleMode" value="auto" checked={scheduleMode === 'auto'} onChange={() => setScheduleMode('auto')} disabled={!canMutate} /> Auto-publish only
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="radio" name="scheduleMode" value="manual" checked={scheduleMode === 'manual'} onChange={() => setScheduleMode('manual')} disabled={!canMutate} /> Manual only
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="radio" name="scheduleMode" value="both" checked={scheduleMode === 'both'} onChange={() => setScheduleMode('both')} disabled={!canMutate} /> Both
              </label>
            </div>
          </div>
          <div>
            <Button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !canMutate}>{saveMutation.isPending ? 'Saving…' : 'Save subscriptions'}</Button>
          </div>
        </div>
      </section>

      {integrationView?.id ? (
        <DeliveryLogs integrationId={integrationView.id} canTrigger={isConnected && canMutate} />
      ) : null}
    </div>
  )
}

function StatusPill({ connected }: { connected: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium',
        connected ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-muted bg-muted text-muted-foreground'
      )}
    >
      <span className={cn('h-2 w-2 rounded-full', connected ? 'bg-emerald-500' : 'bg-muted-foreground/50')} />
      {connected ? 'Connected' : 'Not connected'}
    </span>
  )
}

function DeliveryLogs({ integrationId, canTrigger }: { integrationId: string; canTrigger: boolean }) {
  const deliveriesQuery = useQuery({
    queryKey: ['webhook.deliveries', integrationId],
    queryFn: async () => {
      const res = await fetch(`/api/integrations/${integrationId}/deliveries?limit=50`)
      if (!res.ok) throw new Error('Failed to load deliveries')
      const data = await res.json()
      return (data?.items ?? []) as Array<any>
    },
    refetchInterval: 30_000
  })

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/integrations/${integrationId}/events/test`, { method: 'POST' })
      if (!res.ok) throw new Error('Test failed')
    },
    onSuccess: () => deliveriesQuery.refetch().catch(() => undefined)
  })

  const retryMutation = useMutation({
    mutationFn: async (deliveryId: string) => {
      const res = await fetch(`/api/integrations/${integrationId}/deliveries/${deliveryId}/retry`, { method: 'POST' })
      if (!res.ok) throw new Error('Retry failed')
    },
    onSuccess: () => deliveriesQuery.refetch().catch(() => undefined)
  })

  return (
    <section className="rounded-lg border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">Delivery logs</h2>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={deliveriesQuery.isFetching} onClick={() => deliveriesQuery.refetch()}>
            {deliveriesQuery.isFetching ? 'Refreshing…' : 'Refresh'}
          </Button>
          <Button type="button" size="sm" disabled={!canTrigger || testMutation.isPending} onClick={() => testMutation.mutate()}>
            {testMutation.isPending ? 'Sending…' : 'Send test ping'}
          </Button>
        </div>
      </div>
      {deliveriesQuery.isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : deliveriesQuery.data?.length ? (
        <div className="overflow-hidden rounded-md border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">Latency</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {deliveriesQuery.data.map((d) => (
                <DetailsRow key={d.id} d={d} canTrigger={canTrigger} onRetry={(id) => retryMutation.mutate(id)} retryPending={retryMutation.isPending} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No deliveries yet.</p>
      )}
    </section>
  )
}

function formatUtc(value?: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toISOString().replace('T', ' ').replace('Z', 'Z')
}

function DetailsRow({ d, canTrigger, onRetry, retryPending }: { d: any; canTrigger: boolean; onRetry: (id: string) => void; retryPending: boolean }) {
  const [open, setOpen] = useState(false)
  const req = useMemo(() => {
    try { return d.requestHeadersJson ? JSON.parse(d.requestHeadersJson) : null } catch { return null }
  }, [d.requestHeadersJson])
  const hasDetail = Boolean(req) || Boolean(d.responseBody) || Boolean(d.error)
  return (
    <>
      <tr className="border-t text-xs">
        <td className="px-3 py-2">
          <button className="underline underline-offset-2" onClick={() => setOpen((v) => !v)}>{formatUtc(d.createdAt)}</button>
        </td>
        <td className="px-3 py-2">{d.status}</td>
        <td className="px-3 py-2">{d.httpCode ?? '—'}</td>
        <td className="px-3 py-2">{d.durationMs ? `${d.durationMs}ms` : '—'}</td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled={retryPending || !canTrigger} onClick={() => onRetry(d.id)}>
              {retryPending ? 'Retrying…' : 'Retry'}
            </Button>
            {hasDetail ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
                {open ? 'Hide' : 'View'}
              </Button>
            ) : null}
          </div>
        </td>
      </tr>
      {open ? (
        <tr className="border-t bg-muted/20 text-xs">
          <td className="px-3 py-2" colSpan={5}>
            <div className="grid gap-2">
              {req ? (
                <div>
                  <div className="mb-1 font-medium text-foreground">Request headers</div>
                  <pre className="max-h-40 overflow-auto rounded bg-background p-2 text-[11px]">{JSON.stringify(req, null, 2)}</pre>
                </div>
              ) : null}
              {d.responseBody ? (
                <div>
                  <div className="mb-1 font-medium text-foreground">Response</div>
                  <pre className="max-h-40 overflow-auto rounded bg-background p-2 text-[11px]">{String(d.responseBody).slice(0, 4000)}</pre>
                </div>
              ) : null}
              {d.error ? (
                <div className="text-destructive">Error: {String(d.error)}</div>
              ) : null}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  )
}

function genSecret(): string {
  try {
    const u8 = new (typeof Uint8Array !== 'undefined' ? Uint8Array : (require('node:buffer').Buffer))(24) as Uint8Array
    const webcrypto: Crypto | undefined = (globalThis as any)?.crypto || (require('node:crypto').webcrypto as any)
    webcrypto?.getRandomValues?.(u8)
    return Array.from(u8).map((n: number) => n.toString(16).padStart(2, '0')).join('')
  } catch {
    return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
  }
}
