import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useRouterState } from '@tanstack/react-router'
import { useActiveWebsite } from '@common/state/active-website'
import { useMockData } from '@common/dev/mock-data-context'
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
  const { enabled: mockEnabled } = useMockData()
  const routerState = useRouterState()
  const projectId = activeProjectId
  const [targetUrl, setTargetUrl] = useState('')
  const [secret, setSecret] = useState('')
  const [banner, setBanner] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  const snapshotQuery = useQuery({
    queryKey: ['integrations.snapshot', projectId],
    queryFn: () => getWebsiteSnapshot(projectId!, { cache: 'no-store' }),
    enabled: Boolean(projectId && !mockEnabled),
    refetchInterval: 45_000
  })

  const projectQuery = useQuery({
    queryKey: ['project.detail', projectId],
    queryFn: () => getWebsite(projectId!),
    enabled: Boolean(projectId && !mockEnabled)
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
  }, [integrationView?.integration?.configJson])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error('Select a project first.')
      if (!targetUrl.trim() || !secret.trim()) {
        throw new Error('Provide both Target URL and Shared Secret.')
      }
      if (integrationView?.id) {
        const res = await fetch(`/api/integrations/${integrationView.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ config: { targetUrl: targetUrl.trim(), secret: secret.trim() }, status: 'connected' as IntegrationStatus })
        })
        if (!res.ok) throw new Error('Failed to save integration')
        return
      }
      const res = await fetch(`/api/integrations`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ projectId, type: 'webhook', config: { targetUrl: targetUrl.trim(), secret: secret.trim() }, status: 'connected' as IntegrationStatus })
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
  const canMutate = Boolean(projectId) && !mockEnabled
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
            <Input
              id="webhook-secret"
              type="text"
              placeholder="Generated secret"
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
              autoComplete="off"
              disabled={!canMutate}
            />
          </div>
          <div className="flex items-center gap-3">
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
