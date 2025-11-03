import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { useActiveProject } from '@common/state/active-project'
import { useMockData } from '@common/dev/mock-data-context'
import { getProjectSnapshot, updateIntegration } from '@entities/project/service'
import type { IntegrationStatus, ProjectIntegration } from '@entities'
import { integrationManifests, buildIntegrationViews } from '@integrations/shared/catalog'
import type { ProjectIntegrationView } from '@integrations/shared/types'
import { extractErrorMessage } from '@features/projects/shared/helpers'
import { Button } from '@src/common/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@src/common/ui/empty'
import { cn } from '@src/common/ui/cn'

const MOCK_INTEGRATIONS: ProjectIntegration[] = []

export type IntegrationsManagerProps = {
  projectId?: string | null
  variant?: 'page' | 'section'
  className?: string
}

export function IntegrationsManager({ projectId: propProjectId, variant = 'page', className }: IntegrationsManagerProps) {
  const { id: activeProjectId } = useActiveProject()
  const { enabled: mockEnabled } = useMockData()
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
    queryFn: () => getProjectSnapshot(projectId!, { cache: 'no-store' }),
    enabled: Boolean(projectId && !mockEnabled),
    refetchInterval: 45_000
  })

  const integrations = useMemo<ProjectIntegration[]>(
    () => (mockEnabled ? MOCK_INTEGRATIONS : snapshotQuery.data?.integrations ?? []),
    [mockEnabled, snapshotQuery.data?.integrations]
  )

  const integrationViews = useMemo(
    () => snapshotQuery.data?.integrationViews ?? buildIntegrationViews(integrations),
    [snapshotQuery.data?.integrationViews, integrations]
  )

  const orderedViews = useMemo(
    () =>
      integrationManifests
        .map((manifest) => integrationViews.find((view) => view.manifest.type === manifest.type))
        .filter((view): view is ProjectIntegrationView => Boolean(view)),
    [integrationViews]
  )

  const disconnectMutation = useMutation({
    mutationFn: (integrationId: string) => updateIntegration(integrationId, { status: 'disconnected' as IntegrationStatus }),
    onSuccess: () => {
      setBanner({ tone: 'success', text: 'Integration disconnected.' })
      snapshotQuery.refetch().catch(() => undefined)
    },
    onError: (error) => setBanner({ tone: 'error', text: extractErrorMessage(error) })
  })

  const canMutate = Boolean(projectId) && !mockEnabled

  if (!projectId) {
    return (
      <div className={cn(variant === 'page' ? 'mx-auto flex w-full max-w-4xl flex-col gap-6' : 'flex w-full flex-col gap-4', className)}>
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No project selected</EmptyTitle>
            <EmptyDescription>Choose a project to enable publishing destinations.</EmptyDescription>
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
                  <p className="text-xs text-muted-foreground">{view.manifest.description}</p>
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
  view: ProjectIntegrationView
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

  return (
    <Button variant="outline" size="sm" disabled>
      Coming Soon
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
