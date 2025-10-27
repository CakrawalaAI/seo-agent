import { getArticle, getProjectSnapshot } from '@entities/article/service'

type LoaderArgs = {
  context: { queryClient: any }
  params: { projectId: string; articleId: string }
}

export async function loader({ context, params }: LoaderArgs) {
  const qc = context.queryClient
  await Promise.all([
    qc.ensureQueryData({ queryKey: ['article', params.articleId], queryFn: () => getArticle(params.articleId) }),
    qc.ensureQueryData({ queryKey: ['projectSnapshot', params.projectId], queryFn: () => getProjectSnapshot(params.projectId) })
  ])
  return { projectId: params.projectId, articleId: params.articleId }
}
