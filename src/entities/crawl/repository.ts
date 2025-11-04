import { hasDatabase, getDb } from '@common/infra/db'
import { crawlJobs, crawlPages } from '@entities/crawl/db/schema.website'
import { websites } from '@entities/website/db/schema'
import { eq, desc } from 'drizzle-orm'

export const crawlRepo = {
  async startJob(websiteId: string): Promise<string | null> {
    if (!hasDatabase()) return null
    const db = getDb()
    const id = genId('job')
    const now = new Date() as any
    await db.insert(crawlJobs).values({ id, websiteId, startedAt: now, createdAt: now } as any)
    return id
  },
  async completeJob(jobId: string) {
    if (!hasDatabase()) return
    const db = getDb()
    await db.update(crawlJobs).set({ completedAt: new Date() as any }).where(eq(crawlJobs.id, jobId))
  },
  async recordPage(input: {
    websiteId: string
    jobId: string
    url: string
    httpStatus?: number | null
    title?: string | null
    content?: string | null
    summary?: string | null
  }) {
    if (!hasDatabase()) return
    const db = getDb()
    const id = genId('page')
    await db
      .insert(crawlPages)
      .values({
        id,
        websiteId: input.websiteId,
        jobId: input.jobId,
        url: input.url,
        httpStatus: input.httpStatus ?? null,
        title: input.title ?? null,
        content: input.content ?? null,
        summary: input.summary ?? null,
        createdAt: new Date() as any
      } as any)
  },
  async listRecentPages(websiteId: string, limit = 200) {
    if (!hasDatabase()) return []
    const db = getDb()
    return await db
      .select()
      .from(crawlPages)
      .where(eq(crawlPages.websiteId, websiteId))
      .orderBy(desc(crawlPages.createdAt as any))
      .limit(limit)
  }
}

function genId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}
