// @ts-nocheck
import { DiscoveryJobPayloadSchema } from '@seo-agent/domain'
import { getDb } from '../db'
import { getJobCoordinator } from '../jobs/coordinator'
import { getProject } from './projects'

const ONE_DAY_MS = 24 * 60 * 60 * 1000
const DEFAULT_MAX_KEYWORDS = 500
const ABSOLUTE_MAX_KEYWORDS = 2000

const clampKeywordTarget = (requested?: number) => {
  if (!requested || Number.isNaN(requested)) {
    return DEFAULT_MAX_KEYWORDS
  }
  return Math.max(1, Math.min(requested, ABSOLUTE_MAX_KEYWORDS))
}

const calculateCostEstimate = (keywordCount: number, includeGAds: boolean) => {
  const labsSubtotalRaw = 0.021 + 0.0003 * keywordCount
  const labsSubtotal = Number(labsSubtotalRaw.toFixed(3))
  const gadsSubtotalRaw = includeGAds ? 0.05 : 0
  const gadsSubtotal = includeGAds ? Number(gadsSubtotalRaw.toFixed(3)) : undefined
  const total = Number((labsSubtotal + (gadsSubtotal ?? 0)).toFixed(3))
  return {
    currency: 'usd',
    labsSubtotal,
    gadsSubtotal,
    total
  }
}

export const startDiscovery = async (input: string | {
  projectId: string
  locale?: string
  location?: string
  maxKeywords?: number
  includeGAds?: boolean
  dedupeWindowMs?: number
}) => {
  const options = typeof input === 'string' ? { projectId: input } : input
  const projectId = options.projectId
  const project = await getProject(projectId)
  if (!project) {
    throw new Error('Project not found')
  }

  const db = getDb()
  const dedupeWindowMs = options.dedupeWindowMs ?? ONE_DAY_MS
  const windowStart = new Date(Date.now() - dedupeWindowMs)

  const recentJob = await db.query.jobs.findFirst({
    where: (jobs, { and: andOp, eq: eqOp, gt: gtOp }) =>
      andOp(eqOp(jobs.projectId, projectId), eqOp(jobs.type, 'discovery'), gtOp(jobs.createdAt, windowStart)),
    orderBy: (jobs, { desc: descOp }) => [descOp(jobs.createdAt)]
  })

  if (recentJob) {
    const previousPayload = (recentJob.payload ?? {}) as any
    return {
      jobId: recentJob.id,
      projectId,
      reused: true,
      costEstimate: previousPayload?.costEstimate
    }
  }

  const crawlPages = await db.query.crawlPages.findMany({
    where: (table, { eq: eqOp }) => eqOp(table.projectId, projectId),
    limit: 20
  })

  const locale = options.locale ?? project.defaultLocale
  const location = options.location?.trim() || undefined
  const includeGAds = Boolean(options.includeGAds)
  const maxKeywords = clampKeywordTarget(options.maxKeywords)
  const costEstimate = calculateCostEstimate(maxKeywords, includeGAds)

  const payload = DiscoveryJobPayloadSchema.parse({
    projectId,
    pageIds: crawlPages.map((page) => page.id),
    locale,
    location,
    maxKeywords,
    includeGAds,
    costEstimate
  })

  const coordinator = getJobCoordinator()
  const jobId = await coordinator.enqueue({
    projectId,
    type: 'discovery',
    payload,
    priority: 0
  })

  return {
    jobId,
    projectId,
    costEstimate,
    reused: false
  }
}
