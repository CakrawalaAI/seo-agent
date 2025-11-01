import type { CrawlPage } from './domain/page'
import { hasDatabase, getDb } from '@common/infra/db'
import { crawlPages as crawlPagesTable } from './db/schema'
import { eq } from 'drizzle-orm'

export const crawlRepo = {
  async list(projectId: string, limit = 100): Promise<CrawlPage[]> {
    if (!hasDatabase()) return []
    const db = getDb()
    const rows = await db.select().from(crawlPagesTable).where(eq(crawlPagesTable.projectId, projectId)).limit(limit)
    return rows as any
  },
  async addOrUpdate(projectId: string, page: Omit<CrawlPage, 'id' | 'projectId' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<CrawlPage> {
    const id = page.id ?? genId('page')
    const now = new Date()
    if (hasDatabase()) {
      try {
        const db = getDb()
        // upsert by (projectId,url)
        // @ts-ignore
        await db
          .insert(crawlPagesTable)
          .values({
            id,
            projectId,
            url: page.url,
            depth: (page.depth ?? 0) as any,
            httpStatus: (page.httpStatus as any) ?? null,
            status: (page.status as any) ?? ('completed' as any),
            extractedAt: page.extractedAt ? (new Date(page.extractedAt as any) as any) : (now as any),
            metaJson: (page.metaJson as any) ?? null,
            headingsJson: ((page as any).headingsJson as any) ?? null,
            linksJson: ((page as any).linksJson as any) ?? null,
            contentBlobUrl: ((page as any).contentBlobUrl as any) ?? null,
            createdAt: now as any,
            updatedAt: now as any
          } as any)
          .onConflictDoUpdate?.({ target: [crawlPagesTable.projectId, crawlPagesTable.url], set: {
            depth: (page.depth ?? 0) as any,
            httpStatus: (page.httpStatus as any) ?? null,
            status: (page.status as any) ?? ('completed' as any),
            extractedAt: page.extractedAt ? (new Date(page.extractedAt as any) as any) : (now as any),
            metaJson: (page.metaJson as any) ?? null,
            headingsJson: ((page as any).headingsJson as any) ?? null,
            linksJson: ((page as any).linksJson as any) ?? null,
            contentBlobUrl: ((page as any).contentBlobUrl as any) ?? null,
            updatedAt: now as any
          } })
        console.info('[crawl] inserted page', { projectId, url: page.url, id })
      } catch (err) {
        console.error('[crawl] insert page failed', { projectId, url: page.url, error: (err as Error)?.message || String(err) })
      }
    }
    return {
      id,
      projectId,
      url: page.url,
      depth: page.depth ?? 0,
      httpStatus: page.httpStatus ?? null,
      status: (page.status as any) ?? 'completed',
      metaJson: page.metaJson ?? null,
      headingsJson: (page as any).headingsJson ?? null,
      linksJson: (page as any).linksJson ?? null,
      contentBlobUrl: (page as any).contentBlobUrl ?? null,
      extractedAt: (page.extractedAt as any) ?? now.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    }
  },
  async seedRun(projectId: string): Promise<{ jobId: string; added: number }> {
    const now = new Date().toISOString()
    const sample = [
      { url: 'https://example.com/', depth: 0, httpStatus: 200, metaJson: { title: 'Home page' } },
      { url: 'https://example.com/about', depth: 1, httpStatus: 200, metaJson: { title: 'About us' } },
      { url: 'https://example.com/blog', depth: 1, httpStatus: 200, metaJson: { title: 'Blog' } }
    ]
    for (const p of sample) {
      await crawlRepo.addOrUpdate(projectId, { ...p, status: 'completed', extractedAt: now })
    }
    return { jobId: genId('crawl'), added: sample.length }
  },
  async removeByProject(projectId: string) {
    if (!hasDatabase()) return
    const db = getDb()
    await db.delete(crawlPagesTable).where(eq(crawlPagesTable.projectId, projectId))
  }
}

function genId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}
