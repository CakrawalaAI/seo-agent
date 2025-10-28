import { useQuery } from '@tanstack/react-query'
import { Label } from '@src/common/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@src/common/ui/select'
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
      <Label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-sidebar-foreground/60">
        Switch your project
      </Label>
      {items.length > 0 ? (
        <Select value={id || undefined} onValueChange={(v) => setId(v || null)}>
          <SelectTrigger className="w-full text-sm">
            <SelectValue placeholder="Select project" />
          </SelectTrigger>
          <SelectContent>
            {items.map((p: any) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Link to="/projects" className="text-sidebar-primary underline">
          Create project
        </Link>
      )}
    </div>
  )
}
