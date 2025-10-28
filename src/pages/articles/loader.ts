import { fetchSession } from '@entities/org/service'

export async function loader() {
  const me = await fetchSession()
  return { activeProjectId: (me as any)?.activeProjectId ?? null }
}

