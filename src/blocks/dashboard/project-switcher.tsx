import { useQuery } from '@tanstack/react-query'
import { Label } from '@src/common/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@src/common/ui/select'
import { useActiveWebsite } from '@common/state/active-website'
import { listWebsites } from '@entities/website/service'
import { fetchSession } from '@entities/org/service'
import type { MeSession } from '@entities'
import { Link, useNavigate } from '@tanstack/react-router'

export function WebsiteSwitcher() {
  const navigate = useNavigate()
  const me = useQuery<MeSession>({ queryKey: ['me'], queryFn: fetchSession, staleTime: 60_000 })
  const activeOrgId = me.data?.activeOrg?.id
  const websitesQuery = useQuery({
    queryKey: ['websites', activeOrgId ?? 'none'],
    queryFn: () => listWebsites(activeOrgId ?? ''),
    enabled: Boolean(activeOrgId)
  })
  const items = websitesQuery.data?.items ?? []
  const { id, setId } = useActiveWebsite()

  if (!activeOrgId) return null

  return (
    <div className="px-2 pb-2 pt-1 text-xs">
      <Label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-sidebar-foreground/60">
        Switch your website
      </Label>
      {items.length > 0 ? (
        <Select
          value={id || undefined}
          onValueChange={(v) => {
            if (v === '__create__') {
              try { navigate({ to: '/dashboard' }) } catch {}
              return
            }
            setId(v || null)
          }}
        >
          <SelectTrigger className="w-full text-sm">
            <SelectValue placeholder="Select website" />
          </SelectTrigger>
          <SelectContent>
            {items.map((p: any) => (
              <SelectItem key={p.id} value={p.id}>
                {p.url || p.name || p.id}
              </SelectItem>
            ))}
            <SelectItem value="__create__" className="text-sidebar-primary">
              + New website…
            </SelectItem>
          </SelectContent>
        </Select>
      ) : (
        <Link to="/dashboard" className="text-sidebar-primary underline">
          Create website
        </Link>
      )}
    </div>
  )
}
