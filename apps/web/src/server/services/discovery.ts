// @ts-nocheck
import { DiscoveryJobPayloadSchema } from '@seo-agent/domain'
import { getDb } from '../db'
import { getJobCoordinator } from '../jobs/coordinator'
import { getProject } from './projects'

export const startDiscovery = async (projectId: string) => {
  const project = await getProject(projectId)
  if (!project) {
    throw new Error('Project not found')
  }

  const db = getDb()
  const crawlPages = await db.query.crawlPages.findMany({
    where: (table, { eq }) => eq(table.projectId, projectId),
    limit: 20
  })

  const payload = DiscoveryJobPayloadSchema.parse({
    projectId,
    pageIds: crawlPages.map((page) => page.id),
    locale: project.defaultLocale
  })

  const coordinator = getJobCoordinator()
  const jobId = await coordinator.enqueue({
    projectId,
    type: 'discovery',
    payload,
    priority: 0
  })

  return { jobId }
}
