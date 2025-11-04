import { articlesRepo } from '@entities/article/repository'
import { websiteCrawlRepo } from '@entities/crawl/repository.website'
import { getResearchProvider, getLlmProvider } from '@common/providers/registry'
import * as bundle from '@common/bundle/store'

export async function processEnrich(payload: { projectId: string; articleId: string }) {
  const article = await articlesRepo.get(payload.articleId)
  if (!article) return
  const research = getResearchProvider()
  // Citations via research provider
  const q = article.title || ''
  let citations: Array<{ title: string; url: string; snippet?: string }> = []
  try { citations = await research.search(q, { topK: 5 }); try { const { appendJsonl } = await import('@common/bundle/store'); appendJsonl('global', 'metrics/costs.jsonl', { node: 'research', provider: process.env.EXA_API_KEY ? 'exa' : 'stub', at: new Date().toISOString(), stage: 'citations' }) } catch {}; try { const { updateCostSummary } = await import('@common/metrics/costs'); updateCostSummary() } catch {} } catch {}
  // Internal links: from recent crawl pages (exclude homepage)
  const crawlPages = await websiteCrawlRepo.listRecentPages(String(payload.projectId), 200)
  const internal = crawlPages
    .filter((page) => {
      try {
        const loc = new URL(page.url)
        return loc.pathname !== '/' && !loc.pathname.endsWith('/')
      } catch {
        return false
      }
    })
    .slice(0, 10)
    .map((page) => ({ anchor: (page as any).title || 'Related', url: page.url }))
  const enrichment = {
    citations,
    internalLinks: internal,
    youtube: [] as Array<{ title: string; url: string }>,
    seoScore: Math.min(100, (citations.length * 10) + (internal.length * 5)),
    factCheck: { score: 0 as number, notes: '' as string }
  }
  // YouTube candidates via site filter
  try {
    const yt = await research.search(q, { topK: 3, site: 'youtube.com' })
    try { const { appendJsonl } = await import('@common/bundle/store'); appendJsonl('global', 'metrics/costs.jsonl', { node: 'research', provider: process.env.EXA_API_KEY ? 'exa' : 'stub', at: new Date().toISOString(), stage: 'youtube' }) } catch {}
    const seen = new Set<string>()
    enrichment.youtube = yt
      .filter((r) => r.url && !seen.has(r.url) && seen.add(r.url))
      .map((r) => ({ title: r.title, url: r.url }))
  } catch {}
  // Optional fact-check pass via LLM
  try {
    const llm = getLlmProvider()
    if (typeof llm.factCheck === 'function') {
      const fc = await llm.factCheck({ title: article.title || '', bodyPreview: (article.bodyHtml || '').replace(/<[^>]+>/g, ' ').slice(0, 800), citations })
      enrichment.factCheck = { score: fc.score, notes: fc.notes || '' }
    }
  } catch {}

  // Internal link suggestions: simple title word overlap
  try {
    const title = String(article.title || '')
    const words = new Set(title.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3))
    const candidates = crawlPages
      .map((page) => {
        const t = String((page as any)?.title || '')
        const tokens = new Set(t.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3))
        let overlap = 0
        for (const w of words) if (tokens.has(w)) overlap++
        return { url: page.url, title: t, score: overlap }
      })
      .filter((c) => c.score >= 2)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
    const seen = new Set<string>()
    enrichment.internalLinks = candidates
      .filter((c) => c.url && !seen.has(c.url) && seen.add(c.url))
      .map((c) => ({ anchor: c.title || 'Related', url: c.url }))
  } catch {}
  // write to bundle only (no DB columns for enrichment)
  try { bundle.writeJson(payload.projectId, `articles/drafts/${payload.articleId}.json`, enrichment); bundle.appendLineage(payload.projectId, { node: 'enrich', outputs: { articleId: payload.articleId } }) } catch {}
}
