import { planRepo } from '@entities/article/planner'
import { articlesRepo } from '@entities/article/repository'
import { draftTitleOutline } from '@common/providers/llm'
import { getLlmProvider, getResearchProvider } from '@common/providers/registry'
import { evaluateArticle } from '@features/articles/server/evaluate'
import { ensureSerp } from '@features/serp/server/ensureSerp'
import { websitesRepo } from '@entities/website/repository'
// DB-only runtime: no bundle writes
import { log } from '@src/common/logger'

export async function processGenerate(payload: { projectId?: string; websiteId?: string; planItemId: string; publishAfterGenerate?: boolean }) {
  const found = await planRepo.findById(payload.planItemId)
  if (!found) return
  const { item } = found
  const draft = await articlesRepo.createDraft({
    websiteId: payload.websiteId || payload.projectId,
    planItemId: item.id,
    title: item.title,
    outline: Array.isArray(item.outlineJson) ? (item.outlineJson as any) : undefined
  })
  if (draft.status === 'published') {
    log.info('[generate] skip published article', { articleId: draft.id })
    return
  }
  if (draft.status === 'scheduled' && typeof draft.bodyHtml === 'string' && draft.bodyHtml.trim().length > 0) {
    log.info('[generate] skip already scheduled article', { articleId: draft.id })
    return
  }
  try {
    // Generate outline first if missing
    const needOutline = !draft.outlineJson || draft.outlineJson.length === 0
    let outline = draft.outlineJson ?? []
    if (needOutline) {
      try {
        const o = await draftTitleOutline(draft.title ?? item.title)
        outline = o.outline
        await articlesRepo.update(draft.id, { outlineJson: outline })
      } catch {}
    }
    // Enrich with SERP dump + research/media if available
    let serpDump: string | undefined
    let competitorDump: string | undefined
    let websiteSummary: string | undefined
    let citations: Array<{ title?: string; url: string; snippet?: string }> = []
    let youtube: Array<{ title?: string; url: string }> = []
    let images: Array<{ src: string; alt?: string; caption?: string }> = []
    let internalLinks: Array<{ anchor?: string; url: string }> = []
    try {
      const site = await websitesRepo.get(String(payload.websiteId || payload.projectId))
      const locale = site?.defaultLocale || 'en-US'
      const policy = ((site as any)?.settings || (site as any)?.settingsJson || {}) as { allowYoutube?: boolean; maxImages?: number }
      websiteSummary = site?.summary || undefined
      const { locationCodeFromLocale } = await import('@common/providers/impl/dataforseo/geo-map')
      const loc = locationCodeFromLocale(locale)
      const device: 'desktop' | 'mobile' = 'desktop'
      // Check DB snapshot to avoid refetch
      const { articleSerpRepo } = await import('@entities/article/repository.serp_snapshot')
      const existing = await articleSerpRepo.get(draft.id)
      if (existing && existing.snapshotJson) {
        serpDump = String((existing.snapshotJson as any)?.textDump || '')
      } else {
        const snap = await ensureSerp({ phrase: draft.title ?? item.title, language: locale, locationCode: loc, device, topK: 10 })
        serpDump = String((snap as any)?.textDump || '')
        try { await articleSerpRepo.upsert({ articleId: draft.id, phrase: draft.title ?? item.title, language: locale, locationCode: loc, device, topK: 10, snapshotJson: snap, fetchedAt: new Date() }) } catch {}
      }
      // competitorDump omitted in DB-only mode
      // Research citations + YouTube
      try {
        const research = getResearchProvider()
        citations = await research.search(draft.title ?? item.title, { topK: 5 })
        if (policy.allowYoutube !== false) {
          const yt = await research.search(draft.title ?? item.title, { topK: 2, site: 'youtube.com' })
          youtube = yt.map((r) => ({ title: r.title, url: r.url }))
        }
      } catch {}
      // Internal links from recent crawl pages
      try {
        const { websiteCrawlRepo } = await import('@entities/crawl/repository.website')
        const pages = await websiteCrawlRepo.listRecentPages(String(payload.websiteId || payload.projectId), 50)
        internalLinks = pages
          .filter((p: any) => {
            try { const u = new URL(p.url); return u.pathname !== '/' } catch { return false }
          })
          .slice(0, 8)
          .map((p: any) => ({ anchor: p.title || 'Related', url: p.url }))
      } catch {}
      // Images via Unsplash (preferred)
      try {
        const { searchUnsplash } = await import('@common/providers/impl/unsplash/images')
        const maxImages = Math.max(0, Math.min(4, Number((policy as any).maxImages ?? 2)))
        images = maxImages > 0 ? await searchUnsplash(draft.title ?? item.title, maxImages) : []
      } catch {}
    } catch {}
    const llm = getLlmProvider()
    let { bodyHtml } = await llm.generateBody({ title: draft.title ?? item.title, outline, serpDump, competitorDump, websiteSummary, citations, youtube, images, internalLinks, locale: undefined })
    // Fallback: if no embeds present, append minimal sections
    if (youtube.length && !/youtube\.com|youtu\.be/.test(bodyHtml)) {
      const first = youtube[0]
      const vidIdMatch = first.url.match(/(?:v=|\/embed\/|youtu\.be\/)([A-Za-z0-9_-]{6,})/)
      const vidId = vidIdMatch ? vidIdMatch[1] : ''
      if (vidId) {
        bodyHtml += `\n<section><h2>Watch</h2><div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden"><iframe src="https://www.youtube.com/embed/${vidId}" title="${first.title || 'Video'}" allowfullscreen style="position:absolute;top:0;left:0;width:100%;height:100%"></iframe></div></section>`
      }
    }
    if (images.length && !/<img\s/i.test(bodyHtml)) {
      const im = images[0]
      bodyHtml += `\n<figure><img src="${im.src}" alt="${(im.alt || '').replace(/"/g,'&quot;')}" /><figcaption>${im.caption || ''}</figcaption></figure>`
    }
    if (citations.length && !/References<\/h2>/i.test(bodyHtml)) {
      const refs = citations.map((c, i) => `<li>[${i + 1}] <a href="${c.url}" target="_blank" rel="noreferrer">${c.title || c.url}</a></li>`).join('')
      bodyHtml += `\n<section><h2>References</h2><ol>${refs}</ol></section>`
    }
    // skip bundle cost logs in DB-only mode
    await articlesRepo.update(draft.id, { bodyHtml, generationDate: new Date() as any, status: 'scheduled' })
    // Persist attachments to DB for downstream connectors
    try {
      const { attachmentsRepo } = await import('@entities/article/repository.attachments')
      const toId = (url: string) => {
        const m = url.match(/(?:v=|\/embed\/|youtu\.be\/)([A-Za-z0-9_-]{6,})/)
        return m ? m[1] : ''
      }
      const yt = youtube.map((y) => ({ id: toId(y.url), title: y.title })).filter((y) => y.id)
      await attachmentsRepo.replaceForArticle(draft.id, { images, youtube: yt })
    } catch {}
    // skip bundle writes in DB-only mode
    // queue enrich step
    try {
      const { publishJob, queueEnabled } = await import('@common/infra/queue')
      if (queueEnabled()) { await publishJob({ type: 'enrich', payload: { projectId: String(payload.websiteId || payload.projectId), articleId: draft.id } }) }
    } catch {}

    // Evaluate draft quality (gate autopublish)
    let passedGate = true
    try {
      const evalResult = await evaluateArticle(String(payload.websiteId || payload.projectId), draft.id, { title: draft.title ?? item.title, outline, bodyHtml })
      const threshold = 80
      passedGate = evalResult.score >= threshold
    } catch {}

    // optional immediate publish (policy-driven or first-init override)
    try {
      const immediate = false // global policy only; no per-website override
      if ((immediate || payload.publishAfterGenerate) && passedGate) {
        const { websiteIntegrationsRepo } = await import('@entities/integration/repository.website')
        const integrations = await websiteIntegrationsRepo.list(String(payload.websiteId || payload.projectId))
        const { env } = await import('@common/infra/env')
        const target = (integrations as any[]).find((i) => i.status === 'connected' && env.publicationAllowed.includes(String(i.type)))
        if (target) {
          const { publishJob, queueEnabled } = await import('@common/infra/queue')
          if (queueEnabled()) { await publishJob({ type: 'publish', payload: { articleId: draft.id, integrationId: (target as any).id } }) }
        }
      } else if ((immediate || payload.publishAfterGenerate) && !passedGate) {
        // hold article for manual review
      }
    } catch {}
  } catch {
    // leave stub body
  }
}
