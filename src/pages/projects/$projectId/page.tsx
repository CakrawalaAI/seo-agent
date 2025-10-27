import { ProjectDetailScreen } from '@features/projects/client/project-detail-screen'

export function Page({ projectId, tab }: { projectId: string; tab?: string | null }) {
  return <ProjectDetailScreen projectId={projectId} tab={tab} />
}

