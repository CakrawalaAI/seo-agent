type LoaderArgs = {
  params: { projectId: string; articleId: string }
}

export async function loader({ params }: LoaderArgs) {
  return { projectId: params.projectId, articleId: params.articleId }
}

