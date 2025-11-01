import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useRouterState } from '@tanstack/react-router'
import { LayoutDashboard, FileText, CalendarRange } from 'lucide-react'

import { DashboardShell, type DashboardNavGroup, type DashboardUserSummary } from '@blocks/dashboard/dashboard-shell'
import { ActiveProjectProvider } from '@common/state/active-project'
import { useActiveProject } from '@common/state/active-project'
import type { MeSession } from '@entities'
import { fetchSession } from '@entities/org/service'
import { listProjects, getProjectKeywords, getProjectArticles, getProjectSnapshot } from '@entities/project/service'

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const location = useRouterState({ select: (s) => s.location })
  const pathname = location.pathname
  const search = (location as any).search as Record<string, any>

  const meQuery = useQuery<MeSession>({ queryKey: ['me'], queryFn: fetchSession, staleTime: 60_000 })
  const user = meQuery.data?.user ?? null
  const activeOrg = meQuery.data?.activeOrg ?? null

  const projectsQuery = useQuery<{ items: any[] }>({
    queryKey: ['projects', activeOrg?.id ?? 'none'],
    queryFn: () => listProjects(activeOrg?.id),
    enabled: Boolean(activeOrg?.id)
  })
  const projects = projectsQuery.data?.items ?? []
  const firstProjectId = projects[0]?.id as string | undefined
  const userSummary: DashboardUserSummary | null = user ? { name: user.name, email: user.email } : null

  return (
    <ActiveProjectProvider initialId={(meQuery.data as any)?.activeProjectId ?? null}>
      <DashboardLayoutInner
        pathname={pathname}
        search={search}
        userSummary={userSummary}
        usage={meQuery.data?.usage ?? null}
        hasOrgNoProjects={Boolean(activeOrg?.id && projects.length === 0)}
      >
        {children}
      </DashboardLayoutInner>
    </ActiveProjectProvider>
  )
}

function DashboardLayoutInner({
  pathname,
  search,
  userSummary,
  usage,
  hasOrgNoProjects,
  children
}: {
  pathname: string
  search: Record<string, any>
  userSummary: DashboardUserSummary | null
  usage: any
  hasOrgNoProjects: boolean
  children: React.ReactNode
}) {
  const { id: activeProjectId } = useActiveProject()
  const keywordsCountQuery = useQuery({
    queryKey: ['sidebar.keywords.count', activeProjectId ?? 'none'],
    queryFn: async () => {
      if (!activeProjectId) return 0
      const res = await getProjectKeywords(activeProjectId, 200)
      return (res?.items ?? []).length
    },
    enabled: Boolean(activeProjectId),
    refetchInterval: 5000
  })
  const articlesCountQuery = useQuery({
    queryKey: ['sidebar.articles.count', activeProjectId ?? 'none'],
    queryFn: async () => {
      if (!activeProjectId) return 0
      const res = await getProjectArticles(activeProjectId, 200)
      return (res?.items ?? []).filter((a: any) => a.status === 'draft').length
    },
    enabled: Boolean(activeProjectId),
    refetchInterval: 5000
  })
  const queueDepthQuery = useQuery({
    queryKey: ['sidebar.queue.depth', activeProjectId ?? 'none'],
    queryFn: async () => {
      if (!activeProjectId) return 0
      const snap = await getProjectSnapshot(activeProjectId)
      return Number(snap?.queueDepth || 0)
    },
    enabled: Boolean(activeProjectId),
    refetchInterval: 5000
  })

  const nav = useMemo<DashboardNavGroup[]>(() => {
    const is = (p: string) => pathname === p || pathname.startsWith(`${p}/`)
    const groups: DashboardNavGroup[] = [
      {
        key: 'main',
        items: [
          { key: 'home', label: 'Home', icon: LayoutDashboard, active: is('/dashboard') || pathname === '/', element: <Link to="/dashboard" /> },
          { key: 'calendar', label: 'Calendar', icon: CalendarRange, active: is('/calendar') || (is('/projects') && search?.tab === 'plan'), element: <Link to="/calendar" />, badge: queueDepthQuery.data && queueDepthQuery.data > 0 ? String(queueDepthQuery.data) : undefined },
          { key: 'keywords', label: 'Keywords', icon: FileText, active: is('/keywords') || (is('/projects') && search?.tab === 'keywords'), element: <Link to="/keywords" />, badge: keywordsCountQuery.data && keywordsCountQuery.data > 0 ? String(keywordsCountQuery.data) : undefined },
          { key: 'articles', label: 'Articles', icon: FileText, active: is('/articles'), element: <Link to="/articles" />, badge: articlesCountQuery.data && articlesCountQuery.data > 0 ? String(articlesCountQuery.data) : undefined }
        ]
      }
    ]
    return groups
  }, [pathname, search, keywordsCountQuery.data, articlesCountQuery.data, queueDepthQuery.data])

  return (
    <DashboardShell nav={nav} user={userSummary} usage={usage}>
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
