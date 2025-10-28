import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useRouterState } from '@tanstack/react-router'
import { LayoutDashboard, SquareStack, FileText, CalendarRange, RefreshCcw } from 'lucide-react'

import { DashboardShell, type DashboardNavGroup, type DashboardUserSummary } from '@blocks/dashboard/dashboard-shell'
import { ActiveProjectProvider } from '@common/state/active-project'
import type { MeSession } from '@entities'
import { fetchSession } from '@entities/org/service'
import { listProjects } from '@entities/project/service'

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

  const nav = useMemo<DashboardNavGroup[]>(() => {
    const is = (p: string) => pathname === p || pathname.startsWith(`${p}/`)
    const groups: DashboardNavGroup[] = [
      {
        key: 'main',
        items: [
          { key: 'calendar', label: 'Calendar', icon: CalendarRange, active: is('/calendar') || (is('/projects') && search?.tab === 'plan'), element: <Link to="/calendar" /> },
          { key: 'keywords', label: 'Keywords', icon: FileText, active: is('/keywords') || (is('/projects') && search?.tab === 'keywords'), element: <Link to="/keywords" /> },
          { key: 'articles', label: 'Articles', icon: FileText, active: is('/articles'), element: <Link to="/articles" /> },
          { key: 'projects', label: 'Projects', icon: SquareStack, active: is('/projects'), element: <Link to="/projects" /> },
          { key: 'settings', label: 'Settings', icon: FileText, active: is('/settings'), element: <Link to="/settings" /> }
        ]
      },
      {
        key: 'support',
        items: [
          { key: 'contact', label: 'Contact Us', icon: FileText, href: 'mailto:support@example.com' },
          { key: 'help', label: 'Help Center', icon: FileText, href: 'https://docs.example.com' }
        ]
      }
    ]
    return groups
  }, [pathname])

  const userSummary: DashboardUserSummary | null = user ? { name: user.name, email: user.email } : null

  return (
    <DashboardShell nav={nav} user={userSummary} usage={meQuery.data?.usage ?? null}>
      <ActiveProjectProvider initialId={(meQuery.data as any)?.activeProjectId ?? null}>
        {/* Global callout when org exists but no projects */}
        {activeOrg?.id && projects.length === 0 ? (
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
      </ActiveProjectProvider>
    </DashboardShell>
  )
}
