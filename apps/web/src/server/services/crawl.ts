// @ts-nocheck
import {
  CrawlJobPayloadSchema,
  DEFAULT_CRAWL_BUDGET
} from '@seo-agent/domain'
import type { PaginatedResponse, Job, CrawlPage } from '@seo-agent/domain'
import { and, eq, ilike, lt } from 'drizzle-orm'
import { getJobCoordinator } from '../jobs/coordinator'
import { getProject } from './projects'
import { getDb, schema } from '../db'
import { serializeJob } from './jobs'

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

const clampLimit = (value: number | undefined, fallback: number, max: number) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback
  return Math.min(Math.max(Math.floor(value), 1), max)
}

const parseCursor = (value?: string | null) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export const listCrawlRuns = async (
  filters: { projectId?: string; cursor?: string; limit?: number } = {}
): Promise<PaginatedResponse<Job>> => {
  const db = getDb()
  const limit = clampLimit(filters.limit, 20, 100)
  const cursorDate = parseCursor(filters.cursor)

  const clauses = [eq(schema.jobs.type, 'crawl')]
  if (filters.projectId) {
    clauses.push(eq(schema.jobs.projectId, filters.projectId))
  }
  if (cursorDate) {
    clauses.push(lt(schema.jobs.createdAt, cursorDate))
  }

  const [first, ...rest] = clauses
  const whereClause = rest.length ? and(first, ...rest) : first

  const rows = await db
    .select()
    .from(schema.jobs)
    .where(whereClause)
    .orderBy((jobs, { desc }) => [desc(jobs.createdAt)])
    .limit(limit + 1)

  const items = rows.slice(0, limit).map(serializeJob)
  const nextCursor =
    rows.length > limit ? rows[limit]?.createdAt?.toISOString() ?? undefined : undefined

  return { items, nextCursor }
}

const serializeCrawlPageRow = (row: typeof schema.crawlPages.$inferSelect): CrawlPage => {
  const meta = (row.meta ?? {}) as Record<string, unknown>
  const headingsRaw = Array.isArray(row.headings) ? row.headings : []
  const linksRaw = Array.isArray(row.links) ? row.links : []

  const headingsJson = headingsRaw
    .map((item: any) => {
      const tag = typeof item?.tag === 'string' ? item.tag : undefined
      const content =
        typeof item?.content === 'string'
          ? item.content
          : typeof item?.text === 'string'
            ? item.text
            : undefined
      if (!tag || !content) return null
      return { tag, content }
    })
    .filter((entry): entry is { tag: string; content: string } => Boolean(entry))

  const linksJson = linksRaw
    .map((item: any) => {
      const href = typeof item?.href === 'string' ? item.href : undefined
      if (!href) return null
      const text = typeof item?.text === 'string' ? item.text : undefined
      return { href, text }
    })
    .filter((entry): entry is { href: string; text?: string } => Boolean(entry))

  const metaJson = {
    title: typeof meta?.title === 'string' ? (meta.title as string) : undefined,
    description:
      typeof meta?.description === 'string' ? (meta.description as string) : undefined
  }

  return {
    id: row.id,
    projectId: row.projectId,
    url: row.url,
    httpStatus: row.httpStatus,
    contentHash: row.contentHash,
    extractedAt: row.extractedAt?.toISOString?.() ?? new Date().toISOString(),
    metaJson,
    headingsJson,
    linksJson,
    contentBlobUrl: row.contentBlobUrl
  }
}

export const listCrawlPages = async (filters: {
  projectId?: string
  cursor?: string
  limit?: number
  query?: string
}): Promise<PaginatedResponse<CrawlPage>> => {
  if (!filters.projectId) {
    const error = new Error('projectId is required')
    ;(error as any).status = 400
    throw error
  }

  const db = getDb()
  const limit = clampLimit(filters.limit, 25, 200)
  const cursorDate = parseCursor(filters.cursor)
  const queryText = filters.query?.trim()

  const clauses = [eq(schema.crawlPages.projectId, filters.projectId)]
  if (cursorDate) {
    clauses.push(lt(schema.crawlPages.extractedAt, cursorDate))
  }
  if (queryText) {
    clauses.push(ilike(schema.crawlPages.url, `%${queryText.replace(/\s+/g, '%')}%`))
  }

  const [first, ...rest] = clauses
  const whereClause = rest.length ? and(first, ...rest) : first

  const rows = await db
    .select()
    .from(schema.crawlPages)
    .where(whereClause)
    .orderBy((pages, { desc }) => [desc(pages.extractedAt)])
    .limit(limit + 1)

  const items = rows.slice(0, limit).map(serializeCrawlPageRow)
  const nextCursor =
    rows.length > limit ? rows[limit]?.extractedAt?.toISOString() ?? undefined : undefined

  return { items, nextCursor }
}
