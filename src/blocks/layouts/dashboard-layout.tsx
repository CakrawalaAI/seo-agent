import { useCallback, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { Home, ListChecks, CalendarDays, FileText, Plug, UserCircle2 } from 'lucide-react'

import { DashboardShell, type DashboardNavGroup, type DashboardUserSummary } from '@blocks/dashboard/dashboard-shell'
import { MockDataProvider } from '@common/dev/mock-data-context'
import { ActiveProjectProvider } from '@common/state/active-project'
import { useActiveProject } from '@common/state/active-project'
import type { MeSession } from '@entities'
import { fetchSession } from '@entities/org/service'
import { listProjects } from '@entities/project/service'

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const location = useRouterState({ select: (s) => s.location })
  const pathname = location.pathname
  const search = (location as any).search as Record<string, any>
  const requestedProjectParam = typeof search?.project === 'string' ? (search.project as string) : null
  const navigate = useNavigate()

  const meQuery = useQuery<MeSession>({ queryKey: ['me'], queryFn: fetchSession, staleTime: 60_000 })
  const user = meQuery.data?.user ?? null
  const activeOrg = meQuery.data?.activeOrg ?? null

  const projectsQuery = useQuery<{ items: any[] }>({
    queryKey: ['projects', activeOrg?.id ?? 'none'],
    queryFn: () => listProjects(activeOrg?.id),
    enabled: Boolean(activeOrg?.id)
  })
  const projects = projectsQuery.data?.items ?? []

  const searchValueById = useMemo(() => {
    const map = new Map<string, string>()
    for (const project of projects) {
      const searchValue = projectToSearchValue(project)
      if (searchValue) map.set(project.id, searchValue)
    }
    return map
  }, [projects])

  const getSearchValue = useCallback(
    (id: string) => searchValueById.get(id) ?? id,
    [searchValueById]
  )

  const resolvedProjectId = useMemo<string | null>(() => {
    if (projects.length === 0) return null
    if (!requestedProjectParam) return projects[0]?.id ?? null
    const byId = projects.find((project: any) => project.id === requestedProjectParam)
    if (byId) return byId.id
    const bySearch = projects.find((project: any) => projectToSearchValue(project) === requestedProjectParam)
    if (bySearch) return bySearch.id
    return projects[0]?.id ?? null
  }, [projects, requestedProjectParam])

  useEffect(() => {
    if (projectsQuery.isLoading) return
    if (!projects.length) {
      if (requestedProjectParam) {
        navigate({
          search: ((prev: Record<string, unknown>) => {
            const next = { ...prev }
            delete next.project
            return next
          }) as never,
          replace: true
        })
      }
      return
    }
    if (resolvedProjectId) {
      const desired = searchValueById.get(resolvedProjectId) ?? resolvedProjectId
      if (requestedProjectParam !== desired) {
        navigate({
          search: ((prev: Record<string, unknown>) => ({ ...prev, project: desired })) as never,
          replace: true
        })
      }
    }
  }, [navigate, projects, projectsQuery.isLoading, requestedProjectParam, resolvedProjectId, searchValueById])
  const userSummary: DashboardUserSummary | null = user
    ? { name: user.name, email: user.email, plan: meQuery.data?.activeOrg?.plan ?? null }
    : null

  return (
    <MockDataProvider>
      <ActiveProjectProvider
        initialId={resolvedProjectId}
        buildSearchValue={(id) => (id ? getSearchValue(id) : null)}
      >
        <DashboardLayoutInner
          pathname={pathname}
          userSummary={userSummary}
          hasOrgNoProjects={Boolean(activeOrg?.id && projects.length === 0)}
          getSearchValue={getSearchValue}
        >
          {children}
        </DashboardLayoutInner>
      </ActiveProjectProvider>
    </MockDataProvider>
  )
}

function DashboardLayoutInner({
  pathname,
  userSummary,
  hasOrgNoProjects,
  getSearchValue,
  children
}: {
  pathname: string
  userSummary: DashboardUserSummary | null
  hasOrgNoProjects: boolean
  getSearchValue: (id: string) => string
  children: React.ReactNode
}) {
  const { id: activeProjectId } = useActiveProject()

  const nav = useMemo<DashboardNavGroup[]>(() => {
    const is = (p: string) => pathname === p || pathname.startsWith(`${p}/`)
    const groups: DashboardNavGroup[] = [
      {
        key: 'main',
        items: [
          {
            key: 'dashboard',
            label: 'Dashboard',
            icon: Home,
            active: is('/dashboard') || pathname === '/',
            element: <Link to="/dashboard" search={() => (activeProjectId ? { project: getSearchValue(activeProjectId) } : {})} />
          },
          {
            key: 'keywords',
            label: 'Keywords',
            icon: ListChecks,
            active: is('/keywords'),
            element: <Link to="/keywords" search={() => (activeProjectId ? { project: getSearchValue(activeProjectId) } : {})} />
          },
          {
            key: 'calendar',
            label: 'Calendar',
            icon: CalendarDays,
            active: is('/calendar'),
            element: <Link to="/calendar" search={() => (activeProjectId ? { project: getSearchValue(activeProjectId) } : {})} />
          },
          {
            key: 'articles',
            label: 'Articles',
            icon: FileText,
            active: is('/articles'),
            element: <Link to="/articles" search={() => (activeProjectId ? { project: getSearchValue(activeProjectId) } : {})} />
          },
          {
            key: 'integrations',
            label: 'Integrations',
            icon: Plug,
            active: is('/integrations'),
            element: <Link to="/integrations" search={() => (activeProjectId ? { project: getSearchValue(activeProjectId) } : {})} />
          },
          {
            key: 'settings',
            label: 'Settings',
            icon: UserCircle2,
            active: is('/settings'),
            element: <Link to="/settings" search={() => (activeProjectId ? { project: getSearchValue(activeProjectId) } : {})} />
          }
        ]
      }
    ]
    return groups
  }, [pathname, activeProjectId, getSearchValue])

  return (
    <DashboardShell nav={nav} user={userSummary}>
      {hasOrgNoProjects ? (
        <section className="mb-6 rounded-lg border border-dashed bg-muted/30 p-6 text-center">
          <h2 className="text-lg font-semibold">No projects yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first project to start crawling a site and planning content.
          </p>
          <div className="mt-4 flex justify-center">
            <Link
              to="/projects"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            >
              Create project
            </Link>
          </div>
        </section>
      ) : null}
      {children}
    </DashboardShell>
  )
}

function projectToSearchValue(project: any): string | null {
  const raw = typeof project?.siteUrl === 'string' ? project.siteUrl : typeof project?.site_url === 'string' ? project.site_url : null
  if (raw) {
    const trimmed = raw.trim()
    if (trimmed.length > 0) {
      return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed
    }
  }
  return typeof project?.id === 'string' ? project.id : null
}
