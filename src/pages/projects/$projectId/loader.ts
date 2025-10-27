type LoaderArgs = {
  params: { projectId: string }
  search?: { tab?: string }
}

export async function loader({ params, search }: LoaderArgs) {
  // Placeholder: params/search normalization; page consumes via route wrapper props
  return { projectId: params.projectId, tab: typeof search?.tab === 'string' ? search.tab : undefined }
}

