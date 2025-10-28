import { useQuery } from '@tanstack/react-query'
import { useActiveProject } from '@common/state/active-project'
import { listProjects } from '@entities/project/service'
import { fetchSession } from '@entities/org/service'
import type { MeSession } from '@entities'
import { Link } from '@tanstack/react-router'

export function ProjectSwitcher() {
  const me = useQuery<MeSession>({ queryKey: ['me'], queryFn: fetchSession, staleTime: 60_000 })
  const activeOrgId = me.data?.activeOrg?.id
  const projectsQuery = useQuery({
    queryKey: ['projects', activeOrgId ?? 'none'],
    queryFn: () => listProjects(activeOrgId ?? ''),
    enabled: Boolean(activeOrgId)
  })
  const items = projectsQuery.data?.items ?? []
  const { id, setId } = useActiveProject()

  if (!activeOrgId) return null

  return (
    <div className="px-2 pb-2 pt-1 text-xs">
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-sidebar-foreground/60">
        Switch your project
      </label>
      {items.length > 0 ? (
        <select
          value={id ?? ''}
          onChange={(e) => setId(e.target.value || null)}
          className="w-full rounded-md border border-sidebar-border bg-background px-2 py-1 text-sm text-sidebar-foreground"
        >
          {items.map((p: any) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      ) : (
        <Link to="/projects" className="text-sidebar-primary underline">
          Create project
        </Link>
      )}
    </div>
  )
}

