import { getProject, getProjectSnapshot } from '@entities/project/service'
import { getProjectArticles, getCrawlPages, getPlanItems, getProjectKeywords } from '@entities/project/service'

type LoaderArgs = {
  context: { queryClient: any }
  params: { projectId: string }
  search?: { tab?: string }
}

export async function loader({ context, params, search }: LoaderArgs) {
  const projectId = params.projectId
  const qc = context.queryClient
  await Promise.all([
    qc.ensureQueryData({ queryKey: ['project', projectId], queryFn: () => getProject(projectId) }),
    qc.ensureQueryData({ queryKey: ['projectSnapshot', projectId], queryFn: () => getProjectSnapshot(projectId) }),
    qc.ensureQueryData({ queryKey: ['plan', projectId], queryFn: () => getPlanItems(projectId, 90) }),
    qc.ensureQueryData({ queryKey: ['articles', projectId], queryFn: () => getProjectArticles(projectId, 90) }),
    qc.ensureQueryData({ queryKey: ['crawlPages', projectId], queryFn: () => getCrawlPages(projectId, 50) }),
    qc.ensureQueryData({ queryKey: ['keywords', projectId], queryFn: () => getProjectKeywords(projectId, 100) })
  ])
  return { projectId, tab: typeof search?.tab === 'string' ? search.tab : undefined }
}
