import { redirect } from '@tanstack/react-router'
import { fetchSession } from '@entities/org/service'
import { listProjects } from '@entities/project/service'

export async function loader() {
  const me = await fetchSession()
  const orgId = me?.activeOrg?.id
  if (!orgId) return { projectId: null }
  const projects = await listProjects(orgId)
  const first = projects?.items?.[0]?.id
  if (first) {
    throw redirect({ to: '/projects/$projectId', params: { projectId: first }, search: { tab: 'keywords' } })
  }
  return { projectId: null }
}

