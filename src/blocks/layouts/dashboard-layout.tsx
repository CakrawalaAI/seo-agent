import { useCallback, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { Home, ListChecks, CalendarDays, FileText, Plug, UserCircle2 } from 'lucide-react'

import { DashboardShell, type DashboardNavGroup, type DashboardUserSummary } from '@blocks/dashboard/dashboard-shell'
import { ActiveWebsiteProvider } from '@common/state/active-website'
import { useActiveWebsite } from '@common/state/active-website'
import type { MeSession } from '@entities'
import { fetchSession } from '@entities/org/service'
import { listWebsites } from '@entities/website/service'

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const location = useRouterState({ select: (s) => s.location })
  const pathname = location.pathname
  const search = (location as any).search as Record<string, any>
  const requestedProjectParam = typeof search?.website === 'string' ? (search.website as string) : null
  const navigate = useNavigate()

  const meQuery = useQuery<MeSession>({ queryKey: ['me'], queryFn: fetchSession, staleTime: 60_000 })
  const user = meQuery.data?.user ?? null
  const activeOrg = meQuery.data?.activeOrg ?? null

  const projectsQuery = useQuery<{ items: any[] }>({
    queryKey: ['websites', activeOrg?.id ?? 'none'],
    queryFn: () => listWebsites(activeOrg?.id),
    enabled: Boolean(activeOrg?.id)
  })
  const websites = projectsQuery.data?.items ?? []

  const searchValueById = useMemo(() => {
    const map = new Map<string, string>()
    for (const site of websites) {
      const searchValue = websiteToSearchValue(site)
      if (searchValue) map.set(site.id, searchValue)
    }
    return map
  }, [websites])

  const getSearchValue = useCallback(
    (id: string) => searchValueById.get(id) ?? id,
    [searchValueById]
  )

  const resolvedProjectId = useMemo<string | null>(() => {
    if (websites.length === 0) return null
    if (!requestedProjectParam) return websites[0]?.id ?? null
    const byId = websites.find((project: any) => project.id === requestedProjectParam)
    if (byId) return byId.id
    const bySearch = websites.find((project: any) => websiteToSearchValue(project) === requestedProjectParam)
    if (bySearch) return bySearch.id
    return websites[0]?.id ?? null
  }, [websites, requestedProjectParam])

  useEffect(() => {
    if (projectsQuery.isLoading) return
    if (!websites.length) {
      if (requestedProjectParam) {
        navigate({
          search: ((prev: Record<string, unknown>) => {
            const next = { ...prev }
            delete next.website
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
          search: ((prev: Record<string, unknown>) => ({ ...prev, website: desired })) as never,
          replace: true
        })
      }
    }
  }, [navigate, websites, projectsQuery.isLoading, requestedProjectParam, resolvedProjectId, searchValueById])
  const userSummary: DashboardUserSummary | null = user
    ? { name: user.name, email: user.email, plan: meQuery.data?.activeOrg?.plan ?? null }
    : null

  return (
    <ActiveWebsiteProvider
      initialId={resolvedProjectId}
      buildSearchValue={(id) => (id ? getSearchValue(id) : null)}
    >
      <DashboardLayoutInner
        pathname={pathname}
        userSummary={userSummary}
        hasOrgNoProjects={Boolean(activeOrg?.id && websites.length === 0)}
        getSearchValue={getSearchValue}
      >
        {children}
      </DashboardLayoutInner>
    </ActiveWebsiteProvider>
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
  const { id: activeProjectId } = useActiveWebsite()

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
            element: <Link to="/dashboard" search={() => (activeProjectId ? { website: getSearchValue(activeProjectId) } : {})} />
          },
          {
            key: 'keywords',
            label: 'Keywords',
            icon: ListChecks,
            active: is('/keywords'),
            element: <Link to="/keywords" search={() => (activeProjectId ? { website: getSearchValue(activeProjectId) } : {})} />
          },
          {
            key: 'calendar',
            label: 'Calendar',
            icon: CalendarDays,
            active: is('/calendar'),
            element: <Link to="/calendar" search={() => (activeProjectId ? { website: getSearchValue(activeProjectId) } : {})} />
          },
          {
            key: 'articles',
            label: 'Articles',
            icon: FileText,
            active: is('/articles'),
            element: <Link to="/articles" search={() => (activeProjectId ? { website: getSearchValue(activeProjectId) } : {})} />
          },
          {
            key: 'integrations',
            label: 'Integrations',
            icon: Plug,
            active: is('/integrations'),
            element: <Link to="/integrations" search={() => (activeProjectId ? { website: getSearchValue(activeProjectId) } : {})} />
          },
          {
            key: 'settings',
            label: 'Settings',
            icon: UserCircle2,
            active: is('/settings'),
            element: <Link to="/settings" search={() => (activeProjectId ? { website: getSearchValue(activeProjectId) } : {})} />
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
          <h2 className="text-lg font-semibold">No websites yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Add your first website to start crawling and planning content.
          </p>
        </section>
      ) : null}
      {children}
    </DashboardShell>
  )
}

function websiteToSearchValue(project: any): string | null {
  const raw = typeof project?.url === 'string' ? project.url : typeof project?.siteUrl === 'string' ? project.siteUrl : typeof project?.site_url === 'string' ? project.site_url : null
  if (raw) {
    const trimmed = raw.trim()
    if (trimmed.length > 0) {
      return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed
    }
  }
  return typeof project?.id === 'string' ? project.id : null
}
