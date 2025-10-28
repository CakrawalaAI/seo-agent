import { keywordsRepo } from '@entities/keyword/repository'
import { hasDatabase, getDb } from '@common/infra/db'
import { crawlPages, linkGraph } from '@entities/crawl/db/schema'
import { crawlRepo } from '@entities/crawl/repository'
import { summarizeSite, expandSeeds } from '@common/providers/llm'
import { enrichMetrics } from '@common/providers/metrics'
import { discoveryRepo } from '@entities/discovery/repository'
import { eq, desc } from 'drizzle-orm'

export async function processDiscovery(payload: { projectId: string; locale?: string }) {
  const projectId = String(payload.projectId)
  const locale = payload.locale || 'en-US'
  // 1) Get representative pages
  let pages: Array<{ url: string; title?: string; text?: string }> = []
  if (hasDatabase()) {
    try {
      const db = getDb()
      // Prefer pages with highest in-degree from link graph
      // @ts-ignore
      const edges = (await db.select().from(linkGraph).where(eq(linkGraph.projectId, projectId)) as any)
      if (Array.isArray(edges) && edges.length) {
        const indeg = new Map<string, number>()
        for (const e of edges) indeg.set(e.toUrl, (indeg.get(e.toUrl) || 0) + 1)
        const topUrls = Array.from(indeg.entries()).sort((a, b) => b[1] - a[1]).slice(0, 50).map(([u]) => u)
        // @ts-ignore
        const rows = await (db.select().from(crawlPages).where(eq(crawlPages.projectId, projectId)).limit(1000) as any)
        const byUrl = new Map<string, any>(rows.map((r: any) => [r.url, r]))
        pages = topUrls.map((u) => ({ url: u, title: ((byUrl.get(u) as any)?.metaJson)?.title }))
      }
      if (pages.length === 0) {
        // @ts-ignore
        const rows = await (db.select().from(crawlPages).where(eq(crawlPages.projectId, projectId)).orderBy(desc(crawlPages.depth)).limit(50) as any)
        pages = rows.map((r: any) => ({ url: r.url, title: r?.metaJson?.title }))
      }
    } catch {}
  }
  if (pages.length === 0) {
    const sample = crawlRepo.list(projectId, 50)
    pages = sample.map((p: any) => ({ url: p.url, title: p?.metaJson?.title }))
  }
  // 2) LLM summary + topic clusters
  const summary = await summarizeSite(pages)
  // 3) Expand seeds
  const seeds = await expandSeeds(summary.topicClusters || [], locale)
  // 4) Upsert keywords
  keywordsRepo.upsertMany(projectId, seeds, locale)
  // 5) Enrich metrics (provider-gated)
  const after = keywordsRepo.list(projectId, { status: 'all', limit: 200 })
  const enriched = await enrichMetrics(after.map((k) => ({ phrase: k.phrase })), locale, undefined, projectId)
  keywordsRepo.upsertMetrics(projectId, enriched)
  // 6) Record discovery
  const now = new Date().toISOString()
  discoveryRepo.record(projectId, {
    providersUsed: ['crawl', process.env.OPENAI_API_KEY ? 'llm' : 'stub', process.env.DATAFORSEO_LOGIN ? 'dataforseo' : 'pseudo'],
    startedAt: now,
    finishedAt: now,
    status: 'completed',
    summaryJson: summary,
    costMeterJson: { approximate: true }
  })
}
