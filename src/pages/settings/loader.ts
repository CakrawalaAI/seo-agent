import { fetchSession, fetchOrgMembers } from '@entities/org/service'

export async function loader({ context }: { context: { queryClient: any } }) {
  const qc = context.queryClient
  await Promise.all([
    qc.ensureQueryData({ queryKey: ['settings.session'], queryFn: fetchSession }),
    qc.ensureQueryData({ queryKey: ['settings.members'], queryFn: fetchOrgMembers })
  ])
  return null
}
