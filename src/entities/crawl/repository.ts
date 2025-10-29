import type { CrawlPage } from './domain/page'
import { hasDatabase, getDb } from '@common/infra/db'
import { crawlPages as crawlPagesTable } from './db/schema'
// import { desc, eq } from 'drizzle-orm'

const byProject = new Map<string, CrawlPage[]>()

export const crawlRepo = {
  list(projectId: string, limit = 100): CrawlPage[] {
    const all = byProject.get(projectId) ?? []
    return all.slice(0, limit)
  },
  addOrUpdate(projectId: string, page: Omit<CrawlPage, 'id' | 'projectId' | 'createdAt' | 'updatedAt'> & { id?: string }) {
    const list = byProject.get(projectId) ?? []
    const idx = list.findIndex((p) => p.url === page.url)
    const now = new Date().toISOString()
    const record: CrawlPage = {
      id: page.id ?? genId('page'),
      projectId,
      url: page.url,
      depth: page.depth ?? 0,
      httpStatus: page.httpStatus ?? null,
      status: page.status ?? 'completed',
      metaJson: page.metaJson ?? null,
      headingsJson: (page as any).headingsJson ?? null,
      linksJson: (page as any).linksJson ?? null,
      contentBlobUrl: (page as any).contentBlobUrl ?? null,
      extractedAt: page.extractedAt ?? now,
      createdAt: idx >= 0 ? list[idx]!.createdAt : now,
      updatedAt: now
    }
    if (idx >= 0) list[idx] = record
    else list.unshift(record)
    byProject.set(projectId, list)
    if (hasDatabase()) void (async () => {
      try {
        const db = getDb()
        await db
          .insert(crawlPagesTable)
          .values({
            id: record.id,
            projectId: record.projectId,
            url: record.url,
            depth: record.depth as any,
            httpStatus: (record.httpStatus as any) ?? null,
            status: record.status as any,
            extractedAt: record.extractedAt ? (new Date(record.extractedAt as any) as any) : null,
            metaJson: record.metaJson as any,
            headingsJson: record.headingsJson as any,
            linksJson: record.linksJson as any,
            contentBlobUrl: record.contentBlobUrl as any,
            createdAt: record.createdAt ? (new Date(record.createdAt as any) as any) : (new Date() as any),
            updatedAt: record.updatedAt ? (new Date(record.updatedAt as any) as any) : (new Date() as any)
          } as any)
          .onConflictDoNothing?.()
        console.info('[crawl] inserted page', { projectId, url: record.url, id: record.id })
      } catch (err) {
        console.error('[crawl] insert page failed', { projectId, url: record.url, error: (err as Error)?.message || String(err) })
      }
    })()
    return record
  },
  seedRun(projectId: string): { jobId: string; added: number } {
    const now = new Date().toISOString()
    const sample = [
      { url: 'https://example.com/', depth: 0, httpStatus: 200, metaJson: { title: 'Home page' } },
      { url: 'https://example.com/about', depth: 1, httpStatus: 200, metaJson: { title: 'About us' } },
      { url: 'https://example.com/blog', depth: 1, httpStatus: 200, metaJson: { title: 'Blog' } }
    ]
    for (const p of sample) {
      crawlRepo.addOrUpdate(projectId, { ...p, status: 'completed', extractedAt: now })
    }
    return { jobId: genId('crawl'), added: sample.length }
  }
  ,
  removeByProject(projectId: string) {
    byProject.delete(projectId)
  }
}

function genId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}
