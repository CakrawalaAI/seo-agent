import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { useActiveWebsite } from '@common/state/active-website'
import { getWebsiteSnapshot } from '@entities/website/service'
import type { IntegrationStatus, WebsiteIntegration } from '@entities'
import { integrationManifests, buildIntegrationViews } from '@integrations/shared/catalog'
import type { WebsiteIntegrationView } from '@integrations/shared/types'
import { extractErrorMessage } from '@src/common/ui/format'
import { Button } from '@src/common/ui/button'
import { Badge } from '@src/common/ui/badge'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@src/common/ui/empty'
import { cn } from '@src/common/ui/cn'

// UI mocks removed

export type IntegrationsManagerProps = {
  projectId?: string | null
  variant?: 'page' | 'section'
  className?: string
}

export function IntegrationsManager({ projectId: propProjectId, variant = 'page', className }: IntegrationsManagerProps) {
  const { id: activeProjectId } = useActiveWebsite()
  const navigate = useNavigate()
  const routerState = useRouterState({ select: (s) => s.location.search })
  const projectId = propProjectId ?? activeProjectId ?? null
  const [banner, setBanner] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const currentSearch = useMemo<Record<string, unknown>>(() => {
    if (!routerState) return {}
    if (routerState instanceof URLSearchParams) {
      const result: Record<string, string> = {}
      routerState.forEach((value, key) => {
        result[key] = value
      })
      return result
    }
    if (typeof routerState === 'object') return { ...(routerState as Record<string, unknown>) }
    return {}
  }, [routerState])

  const snapshotQuery = useQuery({
    queryKey: ['integrations.snapshot', projectId],
    queryFn: () => getWebsiteSnapshot(projectId!, { cache: 'no-store' }),
    enabled: Boolean(projectId),
    refetchInterval: 45_000
  })

  const integrations = useMemo<WebsiteIntegration[]>(
    () => snapshotQuery.data?.integrations ?? [],
    [snapshotQuery.data?.integrations]
  )

  const integrationViews = useMemo<WebsiteIntegrationView[]>(
    () => snapshotQuery.data?.integrationViews ?? (buildIntegrationViews(integrations) as WebsiteIntegrationView[]),
    [snapshotQuery.data?.integrationViews, integrations]
  )

  const orderedViews = useMemo(
    () =>
      integrationManifests
        .map((manifest) => integrationViews.find((view) => view.manifest.type === manifest.type))
        .filter((view): view is WebsiteIntegrationView => Boolean(view)),
    [integrationViews]
  )

  const disconnectMutation = useMutation({
    mutationFn: async (integrationId: string) => {
      await fetch(`/api/integrations/${integrationId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'disconnected' }) })
    },
    onSuccess: () => {
      setBanner({ tone: 'success', text: 'Integration disconnected.' })
      snapshotQuery.refetch().catch(() => undefined)
    },
    onError: (error) => setBanner({ tone: 'error', text: extractErrorMessage(error) })
  })

  const canMutate = Boolean(projectId)

  if (!projectId) {
    return (
      <div className={cn(variant === 'page' ? 'mx-auto flex w-full max-w-4xl flex-col gap-6' : 'flex w-full flex-col gap-4', className)}>
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No website selected</EmptyTitle>
            <EmptyDescription>Choose a website to enable publishing destinations.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  const wrapperClass = variant === 'page' ? 'mx-auto flex w-full max-w-4xl flex-col gap-5' : 'flex w-full flex-col gap-4'

  return (
    <div className={cn(wrapperClass, className)}>
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Integrations</h1>
        <p className="text-sm text-muted-foreground">Connect CMS targets and toggle automatic publishing.</p>
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

      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <ul className="divide-y divide-border">
          {orderedViews.map((view) => (
            <li key={view.manifest.type} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="flex flex-1 items-start gap-3">
                <StatusLight active={view.isActive} />
                <div className="min-w-0 space-y-1">
                  {view.manifest.type === 'webhook' ? (
                    <button
                      type="button"
                      className="text-left text-sm font-semibold text-foreground hover:text-primary"
                      onClick={() =>
                        navigate({
                          to: '/integrations/webhook',
                          search: (prev) => ({ ...prev }) as never
                        })
                      }
                    >
                      {view.manifest.name}
                    </button>
                  ) : (
                    <span className="text-sm font-semibold text-foreground">{view.manifest.name}</span>
                  )}
                  <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="px-1.5 py-0 text-[10px] uppercase">
                      {view.manifest.availability === 'ga'
                        ? 'GA'
                        : view.manifest.availability === 'beta'
                          ? 'Beta'
                          : 'Planned'}
                    </Badge>
                    <p>{view.manifest.description}</p>
                  </div>
                </div>
              </div>

              <RowAction
                view={view}
                canMutate={canMutate}
                navigate={navigate}
                currentSearch={currentSearch}
                onDisconnect={() => view.id && disconnectMutation.mutate(view.id)}
                disconnectPending={disconnectMutation.isPending && disconnectMutation.variables === view.id}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

type RowActionProps = {
  view: WebsiteIntegrationView
  canMutate: boolean
  navigate: ReturnType<typeof useNavigate>
  currentSearch: Record<string, unknown>
  onDisconnect: () => void
  disconnectPending: boolean
}

function RowAction({ view, canMutate, navigate, currentSearch, onDisconnect, disconnectPending }: RowActionProps) {
  if (view.status === 'coming_soon') {
    return (
      <Button variant="outline" size="sm" disabled>
        Coming Soon
      </Button>
    )
  }

  if (view.manifest.type === 'webhook') {
    if (view.isActive && view.id) {
      return (
        <Button
          variant="outline"
          size="sm"
          disabled={!canMutate || disconnectPending}
          onClick={onDisconnect}
        >
          {disconnectPending ? 'Disconnecting…' : 'Disconnect'}
        </Button>
      )
    }

    return (
      <Button
        variant="default"
        size="sm"
        disabled={!canMutate}
        onClick={() =>
          navigate({
            to: '/integrations/webhook',
            search: () => ({ ...currentSearch }) as never
          })
        }
      >
        Connect
      </Button>
    )
  }

  const label = view.status === 'coming_soon' ? 'Coming Soon' : 'Details'
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() =>
        navigate({
          to: '/integrations/$integrationId',
          params: { integrationId: view.manifest.type },
          search: () => ({ ...currentSearch }) as never
        })
      }
    >
      {label}
    </Button>
  )
}

function StatusLight({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        'mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full border border-border/60',
        active ? 'bg-emerald-500' : 'bg-muted'
      )}
    />
  )
}
