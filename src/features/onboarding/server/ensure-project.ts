import { hasDatabase, getDb } from '@common/infra/db'
import { queueEnabled, publishJob } from '@common/infra/queue'
import { recordJobQueued } from '@common/infra/jobs'
import { projectsRepo } from '@entities/project/repository'
import { projects } from '@entities/project/db/schema'
import { crawlRepo } from '@entities/crawl/repository'
import type { Project } from '@entities'
import { eq } from 'drizzle-orm'
import { normalizeSiteInput } from '../shared/url'

export type EnsureProjectResult = {
  project: Project
  existed: boolean
  crawlJobId?: string | null
}

export async function ensureProjectForOrg(orgId: string, siteUrlInput: string, options?: { projectName?: string }) {
  const normalized = normalizeSiteInput(siteUrlInput)
  const existing = await findProjectBySiteUrl(orgId, normalized.siteUrl)
  if (existing) {
    return { project: existing, existed: true, crawlJobId: null }
  }
  const project = await projectsRepo.create({
    orgId,
    name: options?.projectName ?? normalized.projectName,
    siteUrl: normalized.siteUrl,
    defaultLocale: 'en-US'
  })
  let crawlJobId: string | null = null
  try {
    const masked = process.env.RABBITMQ_URL
      ? (() => {
          try {
            const u = new URL(process.env.RABBITMQ_URL)
            return `amqp://${u.username || 'user'}:****@${u.hostname}${u.port ? `:${u.port}` : ''}${u.pathname || '/'}`
          } catch {
            return 'amqp://<invalid>'
          }
        })()
      : 'amqp://<missing>'
    console.info('[onboarding] enqueue crawl', { projectId: project.id, queueEnabled: queueEnabled(), rabbit: masked })
    if (queueEnabled()) {
      crawlJobId = await publishJob({ type: 'crawl', payload: { projectId: project.id } })
      recordJobQueued(project.id, 'crawl', crawlJobId)
      console.info('[onboarding] crawl queued', { projectId: project.id, jobId: crawlJobId })
    } else {
      const seeded = await crawlRepo.seedRun(project.id)
      crawlJobId = seeded.jobId
      console.warn('[onboarding] queue disabled; seeded crawl bundle', { projectId: project.id, jobId: crawlJobId })
    }
  } catch (error) {
    console.error('[onboarding] failed to enqueue crawl', { projectId: project.id, error: (error as Error)?.message || String(error) })
  }
  return { project, existed: false, crawlJobId }
}

async function findProjectBySiteUrl(orgId: string, siteUrl: string): Promise<Project | null> {
  if (!hasDatabase()) return null
  try {
    const db = getDb()
    const rows = await db.select().from(projects).where(eq(projects.orgId, orgId)).limit(200)
    const normalized = normalizeSiteInput(siteUrl).siteUrl
    const match = rows.find((row: any) => {
      if (typeof row.siteUrl !== 'string' || !row.siteUrl) return false
      try {
        const current = normalizeSiteInput(row.siteUrl).siteUrl
        return current === normalized
      } catch {
        return false
      }
    })
    if (!match) return null
    return {
      id: match.id,
      orgId: match.orgId,
      name: match.name,
      siteUrl: match.siteUrl ?? undefined,
      defaultLocale: match.defaultLocale,
      autoPublishPolicy: match.autoPublishPolicy ?? undefined,
      status: match.status ?? 'draft',
      bufferDays: match.bufferDays ?? null,
      businessSummary: match.businessSummary ?? null,
      crawlBudget: match.crawlBudget ?? null,
      workflowState: match.workflowState ?? null,
      discoveryApproved: match.discoveryApproved ?? null,
      planningApproved: match.planningApproved ?? null,
      serpDevice: match.serpDevice ?? null,
      serpLocationCode: match.serpLocationCode ?? null,
      metricsLocationCode: match.metricsLocationCode ?? null,
      dfsLanguageCode: match.dfsLanguageCode ?? null,
      createdAt: match.createdAt?.toISOString?.() || match.createdAt,
      updatedAt: match.updatedAt?.toISOString?.() || match.updatedAt
    } as Project
  } catch (error) {
    console.error('[onboarding] findProjectBySiteUrl failed', { orgId, siteUrl, error: (error as Error)?.message || String(error) })
    return null
  }
}
