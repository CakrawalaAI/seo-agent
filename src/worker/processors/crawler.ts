import { websitesRepo } from '@entities/website/repository'
import { crawlRepo } from '@entities/crawl/repository'
// sitemap helpers available if needed for seed top-up in future
import { normalizeUrl, isHtmlLike } from '@common/crawl/url-filter'
// robots intentionally ignored per config (owner consent)
import { env } from '@common/infra/env'
// bundle writes avoided when DB present; keep import only if needed for dev fallback
// import * as bundle from '@common/bundle/store'
import { createHash } from 'node:crypto'
import { config } from '@common/config'
import { getLlmProvider } from '@common/providers/registry'
import { summarizeSite, summarizePage } from '@common/providers/llm'
// keyword persistence removed; summary written to websites
import { log } from '@src/common/logger'

type SeedSource = 'anchor' | 'prefetch' | 'sitemap' | 'heuristic'

const FALLBACK_PATHS = ['/pricing', '/features', '/plans', '/solutions', '/customers', '/case-studies', '/blog', '/resources', '/about', '/contact', '/faq', '/terms', '/privacy', '/careers', '/docs', '/support']

export async function processCrawl(payload: { websiteId?: string; projectId?: string }) {
  const websiteId = String(payload.websiteId || payload.projectId)
  const site = await websitesRepo.get(websiteId)
  if (!site?.url) { log.warn('[crawler] missing url; skipping', { websiteId }); return }
  const siteUrl = site.url!
  let rootUrl: URL
  try {
    rootUrl = new URL(siteUrl)
  } catch {
    log.warn('[crawler] invalid site url; skipping', { websiteId, siteUrl })
    return
  }
  const crawlBudget = Math.max(1, env.crawlBudgetPages || 50)
  log.info('[crawler] start', { websiteId, siteUrl, render: env.crawlRender })
  log.debug('[crawler] config', {
    websiteId,
    siteUrl,
    crawlBudget,
    maxDepth: Math.max(0, env.crawlMaxDepth || 2),
    render: env.crawlRender
  })

  // Seeds: landing page only (BFS), optional sitemap top-ups when few links found
  const rootNormalized = normalizeUrl(rootUrl.href, rootUrl) || rootUrl.toString()
  const initialSeeds = [{ url: rootNormalized, depth: 0 }]
  const jobId = (await crawlRepo.startJob(websiteId))!

  // Attempt Playwright; if unavailable, use undici fetch as fallback
  let usePlaywright = env.crawlRender === 'playwright'
  let chromium: any
  try {
    if (usePlaywright) {
      ({ chromium } = await import('playwright'))
    }
  } catch (err) {
    usePlaywright = false
    log.warn('[crawler] playwright import failed; falling back to fetch', { error: (err as Error)?.message || String(err) })
  }

  let browser: any = null
  let page: any = null
  if (usePlaywright) {
    try {
      browser = await chromium.launch({ headless: true })
      const context = await browser.newContext()
      page = await context.newPage()
      log.info('[crawler] using playwright rendering')
    } catch (err) {
      usePlaywright = false
      log.warn('[crawler] playwright launch failed; falling back to fetch', { error: (err as Error)?.message || String(err) })
    }
  }

  const visitLimit = Math.max(1, crawlBudget)
  const maxDepth = Math.max(0, env.crawlMaxDepth || 2)
  const maxBreadth = Math.max(1, (config.crawl as any)?.maxBreadth ?? 20)
  const seen = new Set<string>()
  const queued = new Set<string>(initialSeeds.map((seed) => seed.url))
  const originCounts: Record<SeedSource, number> = { anchor: 0, prefetch: 0, sitemap: 0, heuristic: 0 }
  const nodes = new Map<string, { url: string; title?: string | null }>()
  const edges: Array<{ from: string; to: string; text?: string | null }> = []
  const queue: Array<{ url: string; depth: number }> = [...initialSeeds]
  let cachedSitemapSeeds: string[] | null = null
  let cachedHeuristicSeeds: string[] | null = null

  const shouldVisit = (candidate: string, source: SeedSource) => {
    if (!isHtmlLike(candidate)) return false
    if (source === 'prefetch') {
      const lowered = candidate.toLowerCase()
      if (/(\.(?:js|mjs|cjs|css|json|ico|svg|png|jpg|jpeg|gif|webp|woff2?))(?:$|\?)/.test(lowered)) return false
    }
    return true
  }

  const tryEnqueue = (candidate: string | null | undefined, source: SeedSource, depth: number) => {
    if (!candidate) return false
    if (seen.has(candidate) || queued.has(candidate)) return false
    if (!shouldVisit(candidate, source)) return false
    queue.push({ url: candidate, depth })
    queued.add(candidate)
    originCounts[source] = (originCounts[source] ?? 0) + 1
    return true
  }
  log.info('[crawler] seeds', { count: initialSeeds.length })
  for (let qi = 0; qi < queue.length && seen.size < visitLimit; qi++) {
    const { url, depth } = queue[qi]!
    if (seen.has(url)) continue
    if (depth > maxDepth) continue
    log.debug('[crawler] visiting', { websiteId, url, depth })
    try {
      let httpStatus: number | null = null
      let title = ''
      let headings: Array<{ level: number; text: string }> = []
      let linksForJson: Array<{ href: string; text?: string }> = []
      let pageHtml: string | null = null
      let textDump: string | null = null
      let contentBlobUrl: string | null = null

      // no in-progress row; persist only finalized page rows (DB-only)
      if (usePlaywright && page) {
        const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
        httpStatus = res?.status() ?? null
        await waitForHydratedLinks(page)
        title = await page.title().catch(() => '')
        try { pageHtml = await page.content() } catch {}
        try { textDump = await page.evaluate(() => document.body?.innerText || '') } catch {}
        let extracted: Array<{ href: string; text?: string; source: SeedSource }> = []
        try {
          extracted = await page.evaluate(() => {
            const results: Array<{ href: string; text?: string; source: 'anchor' | 'prefetch' }> = []
            const seenKeys = new Set<string>()
            const push = (href: string | null | undefined, text: string | null | undefined, source: 'anchor' | 'prefetch') => {
              if (!href) return
              const trimmed = href.trim()
              if (!trimmed) return
              const key = `${source}:${trimmed}`
              if (seenKeys.has(key)) return
              seenKeys.add(key)
              results.push({ href: trimmed, text: text?.trim() || undefined, source })
            }
            document.querySelectorAll('a[href]').forEach((el) => push(el.getAttribute('href'), el.textContent, 'anchor'))
            document.querySelectorAll('[role="link"]').forEach((el) => {
              const element = el as HTMLElement
              push(element.getAttribute('href') || element.getAttribute('data-href') || element.dataset?.href || null, element.textContent, 'anchor')
            })
            document.querySelectorAll('[data-href]').forEach((el) => {
              const element = el as HTMLElement
              push(element.getAttribute('data-href'), element.textContent, 'anchor')
            })
            document.querySelectorAll('link[rel="prefetch"], link[rel="prerender"], link[rel="preload"]').forEach((el) => {
              const link = el as HTMLLinkElement
              push(link.getAttribute('href'), null, 'prefetch')
            })
            return results.slice(0, 500)
          })
        } catch {}
        const base = new URL(url)
        const perPageBreadth = depth === 0 ? Math.max(maxBreadth, visitLimit) : maxBreadth
        let anchorsAdded = 0
        for (const item of extracted) {
          const normalized = normalizeUrl(item.href, base)
          if (!normalized) continue
          if (item.source === 'anchor' && anchorsAdded >= perPageBreadth) continue
          const added = tryEnqueue(normalized, item.source === 'prefetch' ? 'prefetch' : 'anchor', depth + 1)
          if (added && item.source !== 'prefetch') {
            linksForJson.push({ href: normalized, text: item.text })
            anchorsAdded++
          }
        }
        const h1s = await page.$$eval('h1, h2, h3', (nodes: any[]) =>
          nodes.map((n: any) => ({
            level: Number((n.tagName as string).slice(1)),
            text: ((n.textContent as string) || '').trim()
          }))
        )
        headings = h1s
      } else {
        const res = await fetch(url)
        httpStatus = res.status
        const text = await res.text()
        pageHtml = text
        textDump = text.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        const m = text.match(/<title[^>]*>([^<]*)<\/title>/i)
        title = m?.[1]?.trim() ?? ''
        const base = new URL(url)
        const hrefs = Array.from(text.matchAll(/<a\s+[^>]*href\s*=\s*"([^"]+)"[^>]*>(.*?)<\/a>/gis))
        const perPageBreadth = depth === 0 ? Math.max(maxBreadth, visitLimit) : maxBreadth
        let anchorsAdded = 0
        for (const match of hrefs) {
          if (anchorsAdded >= perPageBreadth) break
          const href = match[1] || ''
          const linkText = (match[2] || '').replace(/<[^>]+>/g, '').trim()
          const norm = normalizeUrl(href, base)
          if (!norm || !isHtmlLike(norm)) continue
          const added = tryEnqueue(norm, 'anchor', depth + 1)
          if (added) {
            linksForJson.push({ href: norm, text: linkText || undefined })
            anchorsAdded++
          }
        }
      }

      if (depth === 0) {
        if (cachedSitemapSeeds === null) {
          cachedSitemapSeeds = await collectSitemapSeeds(rootUrl)
        }
        if (cachedSitemapSeeds?.length) {
          for (const seed of cachedSitemapSeeds) {
            const normalized = normalizeUrl(seed, rootUrl)
            if (!normalized) continue
            tryEnqueue(normalized, 'sitemap', depth + 1)
          }
        }
        if (cachedHeuristicSeeds === null) {
          cachedHeuristicSeeds = collectHeuristicSeeds(rootUrl)
        }
        if (cachedHeuristicSeeds?.length) {
          for (const seed of cachedHeuristicSeeds) {
            const normalized = normalizeUrl(seed, rootUrl)
            if (!normalized) continue
            tryEnqueue(normalized, 'heuristic', depth + 1)
          }
        }
      }
      const now = new Date().toISOString()
      // No file storage: keep contentBlobUrl null (DB-only storage)
      const pageId = pageIdFor(url)
      let pageSummary: string | null = null
      try {
        const basis = textDump || pageHtml || ''
        if (basis && basis.length > 0) {
          const s = await summarizePage(basis)
          pageSummary = s || null
        }
      } catch {}
      await crawlRepo.recordPage({ websiteId, jobId, url, httpStatus: httpStatus ?? null, title, content: (title ? title + '\n\n' : '') + (textDump || pageHtml || ''), summary: pageSummary })
      log.debug('[crawler] stored page', { websiteId, url, depth, httpStatus })
      nodes.set(url, { url, title })
      if (linksForJson.length) {
        for (const link of linksForJson.slice(0, 50)) {
          edges.push({ from: url, to: link.href, text: link.text || null })
        }
      }
      seen.add(url)
    } catch {}
  }

  if (usePlaywright && browser) {
    try { await browser.close() } catch {}
  }
  // Skip bundle lineage/link graph in DB-only mode

  log.info('[crawler] done', { visited: seen.size })
  log.info('[crawler] seed summary', {
    websiteId,
    anchor: originCounts.anchor,
    prefetch: originCounts.prefetch,
    sitemap: originCounts.sitemap,
    heuristic: originCounts.heuristic
  })

  // 3) Build one big text of per-page summaries, then summarize within model context budget
  try {
    const pages = await crawlRepo.listRecentPages(websiteId, Math.max(200, crawlBudget))
    log.debug('[crawler] summarizing site', { websiteId, pageCount: pages.length })
    const sections = pages.map((p) => {
      const title = String((p as any)?.title || '')
      const s = String((p as any)?.summary || '')
      return `=== URL: ${p.url} | Title: ${title} ===\n${s}\n\n`
    })
    const dump = sections.join('')
    // No file dump in DB-only mode

    const modelName = 'gpt-5-2025-08-07'
    const defaultCtx = 400_000
    const targetTokens = Math.max(40_000, Math.floor(defaultCtx * 0.8))
    const approxTokens = (s: string) => Math.ceil((s?.length || 0) / 4)
    const trimToTokens = (s: string, tokens: number) => s.slice(0, Math.max(0, tokens) * 4)
    let budgetedDump = approxTokens(dump) > targetTokens ? trimToTokens(dump, targetTokens) : dump
    log.info('[crawler] summary budget', { model: modelName, ctx: defaultCtx, targetTokens, dumpTokens: approxTokens(dump), budgetedTokens: approxTokens(budgetedDump) })

    const llm = getLlmProvider() as any
    let businessSummary: string | null = null
    if (typeof llm.summarizeWebsiteDump === 'function') {
      try {
        businessSummary = await llm.summarizeWebsiteDump(siteUrl, budgetedDump)
      } catch (e) {
        const msg = (e as Error)?.message || ''
        log.warn('[crawler] summarizeWebsiteDump failed; retrying with smaller budget if possible', { error: msg })
        const match = msg.match(/maximum context length is\s+(\d+)\s+tokens/i)
        const maxFromError = match ? Number(match[1]) : NaN
        if (Number.isFinite(maxFromError) && maxFromError > 1000) {
          const retryTokens = Math.floor(maxFromError * 0.8)
          budgetedDump = trimToTokens(dump, retryTokens)
          log.info('[crawler] retry summary budget', { retryTokens, budgetedTokens: approxTokens(budgetedDump) })
          try { businessSummary = await llm.summarizeWebsiteDump(siteUrl, budgetedDump) } catch {}
        }
      }
    }
    if (!businessSummary || !businessSummary.trim()) {
      // Fallback: use first 50 page contents
      const summaryInput = pages.slice(0, 50).map((p) => ({ url: p.url, text: (p as any)?.content || '' }))
      const jsonSummary = await summarizeSite(summaryInput).catch(() => null)
      businessSummary = jsonSummary?.businessSummary || (dump.slice(0, 2000) + ' ...')
    }

    await websitesRepo.patch(websiteId, { summary: businessSummary })
    log.debug('[crawler] summary saved', { websiteId, hasSummary: Boolean(businessSummary && businessSummary.trim()) })
    // No summary file in DB-only mode
  } catch (err) {
    log.warn('[crawler] failed to summarize site', { error: (err as Error)?.message || String(err) })
  }
  try { await crawlRepo.completeJob(jobId) } catch {}
}

function pageIdFor(url: string) {
  return `page_${createHash('sha1').update(url).digest('hex').slice(0, 20)}`
}

function dedupeEdges(edges: Array<{ from: string; to: string; text?: string | null }>) {
  const seen = new Set<string>()
  const out: typeof edges = []
  for (const edge of edges) {
    const key = `${edge.from}->${edge.to}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(edge)
    if (out.length >= 500) break
  }
  return out
}

async function waitForHydratedLinks(page: any) {
  if (!page) return
  try {
    await page.waitForLoadState('networkidle', { timeout: 8000 })
  } catch {}
  try {
    await page.waitForTimeout(300)
  } catch {}
  try {
    await page.waitForFunction(
      () => document && document.querySelectorAll('a[href], [role="link"], [data-href]').length > 0,
      { timeout: 5000 }
    )
  } catch {}
}

async function collectSitemapSeeds(root: URL): Promise<string[]> {
  const seeds: string[] = []
  const visited = new Set<string>()
  const queue: Array<{ target: URL; depth: number }> = []
  for (const path of ['/sitemap.xml', '/sitemap_index.xml']) {
    try {
      queue.push({ target: new URL(path, root), depth: 0 })
    } catch {}
  }
  while (queue.length && seeds.length < 200) {
    const { target, depth } = queue.shift()!
    const key = target.toString()
    if (visited.has(key)) continue
    visited.add(key)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    try {
      const res = await fetch(target.toString(), {
        signal: controller.signal,
        headers: { accept: 'application/xml, text/xml, */*' }
      })
      if (!res.ok) continue
      const text = await res.text()
      const matches = Array.from(text.matchAll(/<loc>([^<]+)<\/loc>/gi))
      for (const match of matches) {
        const raw = (match[1] || '').trim()
        if (!raw) continue
        let candidate: URL | null = null
        try {
          candidate = raw.startsWith('http') ? new URL(raw) : new URL(raw, root)
        } catch {
          candidate = null
        }
        if (!candidate) continue
        if (candidate.host !== root.host) continue
        if (candidate.pathname.toLowerCase().endsWith('.xml')) {
          if (depth < 2) queue.push({ target: candidate, depth: depth + 1 })
          continue
        }
        seeds.push(candidate.toString())
        if (seeds.length >= 200) break
      }
    } catch {
      // ignore
    } finally {
      clearTimeout(timer)
    }
  }
  return seeds
}

function collectHeuristicSeeds(root: URL): string[] {
  const seeds: string[] = []
  for (const path of FALLBACK_PATHS) {
    try {
      seeds.push(new URL(path, root).toString())
    } catch {}
  }
  return seeds
}
