// @ts-nocheck
import { DEFAULT_BUFFER_DAYS } from '@seo-agent/domain'
import { createContext, useContext, useMemo } from 'react'
import { Link, Outlet, createFileRoute, useRouter, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import type { ProjectSnapshot } from '@seo-agent/domain'

type ProjectLayoutContextValue = {
  projectId: string
  snapshot: ProjectSnapshot | undefined
  isLoading: boolean
  refetch: () => void
}

const ProjectLayoutContext = createContext<ProjectLayoutContextValue | null>(null)

export const useProjectLayout = () => {
  const value = useContext(ProjectLayoutContext)
  if (!value) {
    throw new Error('useProjectLayout must be used within ProjectLayout')
  }
  return value
}

const fetchProjectSnapshot = async (projectId: string): Promise<ProjectSnapshot> => {
  const response = await fetch(`/api/projects/${projectId}/snapshot`, {
    credentials: 'include'
  })
  if (!response.ok) {
    throw new Error('Unable to load project snapshot')
  }
  return (await response.json()) as ProjectSnapshot
}

export const Route = createFileRoute('/projects/$projectId')({
  component: ProjectLayout
})

const NAV_ITEMS = [
  { to: '/projects/$projectId/', label: 'Calendar', exact: true },
  { to: '/projects/$projectId/keywords', label: 'Keywords' },
  { to: '/projects/$projectId/articles', label: 'Articles' },
  { to: '/projects/$projectId/integrations', label: 'Integrations' }
] as const

function ProjectLayout() {
  const { projectId } = Route.useParams()
  const router = useRouter()
  const routerState = useRouterState()

  const snapshotQuery = useQuery({
    queryKey: ['project', projectId, 'snapshot'],
    queryFn: () => fetchProjectSnapshot(projectId),
    refetchInterval: 120_000,
    staleTime: 60_000
  })

  const contextValue = useMemo<ProjectLayoutContextValue>(
    () => ({
      projectId,
      snapshot: snapshotQuery.data,
      isLoading: snapshotQuery.isLoading,
      refetch: snapshotQuery.refetch
    }),
    [projectId, snapshotQuery.data, snapshotQuery.isLoading, snapshotQuery.refetch]
  )

  const project = snapshotQuery.data?.project
  const queueDepth = snapshotQuery.data?.queueDepth ?? 0
  const integrationsCount = snapshotQuery.data?.integrations.length ?? 0
  const autopublish = snapshotQuery.data?.project.autoPublishPolicy ?? 'buffered'
  const projectBuffer = snapshotQuery.data?.project.bufferDays ?? DEFAULT_BUFFER_DAYS

  return (
    <ProjectLayoutContext.Provider value={contextValue}>
      <div className="flex min-h-screen bg-background">
        <aside className="hidden w-60 flex-col border-r bg-card/40 p-6 md:flex">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Project</p>
            <h1 className="text-lg font-semibold text-foreground">
              {project?.name ?? 'Loading project…'}
            </h1>
            <p className="truncate text-xs text-muted-foreground">{project?.siteUrl ?? ''}</p>
          </div>
          <dl className="mt-6 grid grid-cols-1 gap-3 text-xs">
            <div className="rounded-md border border-dashed p-3">
              <dt className="text-muted-foreground">Queue depth</dt>
              <dd className="text-base font-semibold text-foreground">{queueDepth}</dd>
            </div>
            <div className="rounded-md border border-dashed p-3">
              <dt className="text-muted-foreground">Integrations</dt>
              <dd className="text-base font-semibold text-foreground">{integrationsCount}</dd>
            </div>
            <div className="rounded-md border border-dashed p-3">
              <dt className="text-muted-foreground">Auto-publish</dt>
              <dd className="text-base font-semibold text-foreground capitalize">{autopublish}</dd>
              {autopublish === 'buffered' ? (
                <p className="text-[11px] text-muted-foreground">Buffer: {projectBuffer} days</p>
              ) : null}
            </div>
          </dl>
          <nav className="mt-8 flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const location = router.buildLocation({ to: item.to, params: { projectId } })
              const active = item.exact
                ? routerState.location.pathname === location.pathname
                : routerState.location.pathname.startsWith(location.pathname)
              const baseClasses = 'flex items-center rounded-md px-3 py-2 text-sm font-medium transition'
              const inactiveClasses = 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              const activeClasses = 'bg-primary/10 text-primary'
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  params={{ projectId }}
                  className={`${baseClasses} ${active ? activeClasses : inactiveClasses}`}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </aside>
        <main className="flex-1">
          <div className="border-b bg-card/30 px-6 py-4 md:hidden">
            <h1 className="text-lg font-semibold text-foreground">{project?.name ?? 'Project dashboard'}</h1>
            <p className="text-xs text-muted-foreground">{project?.siteUrl ?? ''}</p>
          </div>
          <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
            {snapshotQuery.isLoading ? (
              <div className="rounded-md border border-dashed bg-muted/30 p-6 text-sm text-muted-foreground">
                Loading project snapshot…
              </div>
            ) : snapshotQuery.isError ? (
              <div className="rounded-md border border-destructive bg-destructive/10 p-6 text-sm text-destructive">
                Failed to load project data. Try refreshing.
              </div>
            ) : null}
            <Outlet />
          </section>
        </main>
      </div>
    </ProjectLayoutContext.Provider>
  )
}
