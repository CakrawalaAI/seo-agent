// @ts-nocheck
import { CrawlJobPayloadSchema, DEFAULT_CRAWL_BUDGET } from '@seo-agent/domain'
import { getJobCoordinator } from '../jobs/coordinator'
import { getProject } from './projects'

type CrawlBudgetOverride = {
  maxPages?: number
  respectRobots?: boolean
  includeSitemaps?: boolean
}

export const startCrawl = async (projectId: string, override?: CrawlBudgetOverride | null) => {
  const project = await getProject(projectId)
  if (!project) {
    throw new Error('Project not found')
  }

  const maxPages =
    typeof override?.maxPages === 'number' && Number.isFinite(override.maxPages)
      ? override.maxPages
      : DEFAULT_CRAWL_BUDGET
  const respectRobots =
    override?.respectRobots === undefined ? true : Boolean(override?.respectRobots)
  const includeSitemaps =
    override?.includeSitemaps === undefined ? true : Boolean(override?.includeSitemaps)

  const payload = CrawlJobPayloadSchema.parse({
    projectId: project.id,
    siteUrl: project.siteUrl,
    crawlBudget: {
      maxPages,
      respectRobots,
      includeSitemaps
    }
  })

  const coordinator = getJobCoordinator()
  const jobId = await coordinator.enqueue({
    id: undefined,
    projectId: project.id,
    type: 'crawl',
    payload,
    priority: 0
  })

  return { jobId, status: 'queued' }
}

export const getCrawlStatus = async (jobId: string) => {
  const coordinator = getJobCoordinator()
  const job = await coordinator.getJob(jobId)
  if (!job) {
    throw new Error('Job not found')
  }

  return {
    jobId: job.id,
    status: job.status,
    progressPct: job.progressPct ?? 0,
    updatedAt: job.updatedAt ?? new Date()
  }
}
