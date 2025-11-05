import { planRepo } from '@entities/article/planner'
import { articlesRepo } from '@entities/article/repository'
import { getLlmProvider } from '@common/providers/registry'
import { evaluateArticle } from '@features/articles/server/evaluate'
import { websitesRepo } from '@entities/website/repository'
import { collectArticleContext, resolveArticleFeatureFlags } from '@features/articles/server/article-context'
import type { ArticleContextResult } from '@features/articles/server/article-context'
import { buildArticleGenerationPayload } from '@features/articles/server/article-payload'
// DB-only runtime: no bundle writes
import { log } from '@src/common/logger'
import { recordComplimentaryGeneration } from '@common/infra/entitlements'

export async function processGenerate(payload: { projectId?: string; websiteId?: string; planItemId: string; publishAfterGenerate?: boolean }) {
  log.debug('[generate] start', { websiteId: payload.websiteId || payload.projectId, planItemId: payload.planItemId })
  const found = await planRepo.findById(payload.planItemId)
  if (!found) return
  const { item } = found
  const draft = await articlesRepo.createDraft({
    websiteId: payload.websiteId || payload.projectId,
    planItemId: item.id,
    title: item.title,
    targetKeyword: item.targetKeyword ?? item.title,
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
    const llm = getLlmProvider()
    let site: Awaited<ReturnType<typeof websitesRepo.get>> | null = null
    try {
      site = await websitesRepo.get(String(payload.websiteId || payload.projectId))
    } catch (error) {
      log.debug('[generate] site fetch failed', { articleId: draft.id, error: (error as Error)?.message || String(error) })
    }
    const locale = site?.defaultLocale || 'en-US'

    const keywordForSerp = (() => {
      const draftKeyword = typeof draft.targetKeyword === 'string' ? draft.targetKeyword.trim() : ''
      if (draftKeyword) return draftKeyword
      const itemKeyword = typeof item.targetKeyword === 'string' ? item.targetKeyword.trim() : ''
      if (itemKeyword) return itemKeyword
      const draftTitle = typeof draft.title === 'string' ? draft.title.trim() : ''
      if (draftTitle) return draftTitle
      const itemTitle = typeof item.title === 'string' ? item.title.trim() : ''
      return itemTitle
    })()

    // Generate outline first if missing
    const needOutline = !draft.outlineJson || draft.outlineJson.length === 0
    let outline = draft.outlineJson ?? []
    if (needOutline) {
      log.debug('[generate] drafting outline', { articleId: draft.id, title: draft.title })
      const o = await llm.draftOutline(draft.title ?? item.title, locale)
      outline = o.outline
      await articlesRepo.update(draft.id, { outlineJson: outline, title: o.title })
    }
    const features = resolveArticleFeatureFlags(site)
    log.debug('[generate] feature flags', { articleId: draft.id, features })
    const keyword = keywordForSerp || draft.title || item.title || ''
    let context: ArticleContextResult = {
      websiteSummary: site?.summary || undefined,
      serpDump: undefined,
      competitorDump: undefined,
      citations: [] as Array<{ title?: string; url: string; snippet?: string }>,
      youtube: [] as Array<{ title?: string; url: string }>,
      images: [] as Array<{ src: string; alt?: string; caption?: string }>,
      internalLinks: [] as Array<{ anchor?: string; url: string }>,
      features
    }
    try {
      context = await collectArticleContext({
        articleId: draft.id,
        projectId: String(payload.websiteId || payload.projectId || ''),
        locale,
        keyword,
        title: draft.title ?? item.title,
        outline,
        site: site as any,
        features
      })
    } catch (error) {
      log.error('[generate] context collection failed', { articleId: draft.id, error: (error as Error)?.message || String(error) })
    }
    log.debug('[generate] generating body', { articleId: draft.id, outlineSections: outline.length })
    let bodyHtml: string
    const { bodyHtml: generated } = await llm.generateBody({
      title: draft.title ?? item.title,
      outline,
      serpDump: context.serpDump,
      competitorDump: context.competitorDump,
      websiteSummary: context.websiteSummary,
      citations: context.citations,
      youtube: context.youtube,
      images: context.images,
      internalLinks: context.internalLinks,
      locale,
      features: context.features
    })
    bodyHtml = generated
    // Fallback: if no embeds present, append minimal sections
    const youtube = context.features.youtube ? context.youtube : []
    if (youtube.length && !/youtube\.com|youtu\.be/.test(bodyHtml)) {
      const first = youtube[0]
      const vidIdMatch = first.url.match(/(?:v=|\/embed\/|youtu\.be\/)([A-Za-z0-9_-]{6,})/)
      const vidId = vidIdMatch ? vidIdMatch[1] : ''
      if (vidId) {
        bodyHtml += `\n<section><h2>Watch</h2><div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden"><iframe src="https://www.youtube.com/embed/${vidId}" title="${first.title || 'Video'}" allowfullscreen style="position:absolute;top:0;left:0;width:100%;height:100%"></iframe></div></section>`
      }
    }
    const images = (context.features.imageUnsplash || context.features.imageAi) ? context.images : []
    if (images.length && !/<img\s/i.test(bodyHtml)) {
      const im = images[0]
      bodyHtml += `\n<figure><img src="${im.src}" alt="${(im.alt || '').replace(/"/g,'&quot;')}" /><figcaption>${im.caption || ''}</figcaption></figure>`
    }
    const citations = context.citations
    if (citations.length && !/References<\/h2>/i.test(bodyHtml)) {
      const refs = citations.map((c, i) => `<li>[${i + 1}] <a href="${c.url}" target="_blank" rel="noreferrer">${c.title || c.url}</a></li>`).join('')
      bodyHtml += `\n<section><h2>References</h2><ol>${refs}</ol></section>`
    }
    const generationPayload = buildArticleGenerationPayload({
      articleId: draft.id,
      websiteId: draft.websiteId ?? (payload.websiteId || payload.projectId) ?? null,
      title: draft.title ?? item.title,
      targetKeyword: draft.targetKeyword ?? keyword,
      locale,
      outline,
      bodyHtml,
      generatedAt: new Date(),
      context
    })
    // skip bundle cost logs in DB-only mode
    await articlesRepo.update(draft.id, {
      bodyHtml,
      generationDate: new Date() as any,
      status: 'scheduled',
      payloadJson: generationPayload
    })
    if (site?.orgId) {
      try {
        await recordComplimentaryGeneration(site.orgId)
      } catch (error) {
        log.error('[generate] complimentary tracking failed', {
          orgId: site.orgId,
          articleId: draft.id,
          message: (error as Error)?.message || String(error)
        })
      }
    }
    log.debug('[generate] article scheduled', {
      articleId: draft.id,
      hasCitations: citations.length > 0,
      hasYoutube: youtube.length > 0,
      features
    })
    // Persist attachments to DB for downstream connectors
    if (context.features.attachments && (images.length || youtube.length)) {
      try {
        const { attachmentsRepo } = await import('@entities/article/repository.attachments')
        const toId = (url: string) => {
          const m = url.match(/(?:v=|\/embed\/|youtu\.be\/)([A-Za-z0-9_-]{6,})/)
          return m ? m[1] : ''
        }
        const yt = youtube.map((y) => ({ id: toId(y.url), title: y.title })).filter((y) => y.id)
        await attachmentsRepo.replaceForArticle(draft.id, { images, youtube: yt })
      } catch (error) {
        log.warn('[generate] attachments persistence failed', { articleId: draft.id, error: (error as Error)?.message })
      }
    }
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
        const { integrationsRepo } = await import('@entities/integration/repository')
        const integrations = await integrationsRepo.list(String(payload.websiteId || payload.projectId))
        const { env } = await import('@common/infra/env')
        const target = (integrations as any[]).find((i) => i.status === 'connected' && env.publicationAllowed.includes(String(i.type)))
        if (target) {
          const { publishJob, queueEnabled } = await import('@common/infra/queue')
          if (queueEnabled()) { await publishJob({ type: 'publish', payload: { articleId: draft.id, integrationId: (target as any).id } }) }
        }
      } else if ((immediate || payload.publishAfterGenerate) && !passedGate) {
        // hold article for manual review
        log.debug('[generate] hold for review', { articleId: draft.id, scoreGate: passedGate })
      }
    } catch {}
  } catch (error) {
    log.error('[generate] job failed', { articleId: payload.planItemId, error: (error as Error)?.message || String(error) })
    throw error
  }
}
