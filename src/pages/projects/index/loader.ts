import { fetchSession } from '@entities/org/service'
import { listProjects } from '@entities/project/service'

export async function loader({ context }: { context: { queryClient: any } }) {
  const qc = context.queryClient
  const me = await qc.ensureQueryData({ queryKey: ['me'], queryFn: fetchSession })
  const orgId = me?.activeOrg?.id ?? me?.orgs?.[0]?.id ?? 'org-dev'
  await qc.ensureQueryData({ queryKey: ['projects', orgId ?? 'none'], queryFn: () => listProjects(orgId ?? undefined) })
  return null
}
