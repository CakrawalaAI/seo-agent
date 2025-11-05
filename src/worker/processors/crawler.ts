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
import { publishDashboardProgress } from '@common/realtime/hub'

type PlaywrightLease = { page: any; context: any; contextId: string }

class PlaywrightContextPool {
  static async create(options: { browser: any; max: number }) {
    const pool = new PlaywrightContextPool(options.browser, Math.max(1, options.max))
    await pool.ensureCapacity()
    return pool
  }

  private constructor(private browser: any, private max: number) {}

  private available: PlaywrightLease[] = []
  private pending: Array<(lease: PlaywrightLease | null) => void> = []
  private creating = 0
  private current = 0
  private activeLeases = new Set<PlaywrightLease>()
  private destroyed = false

  get size() {
    return this.max
  }

  stats() {
    return {
      max: this.max,
      active: this.activeLeases.size,
      idle: this.available.length,
      pending: this.pending.length,
      current: this.current,
      creating: this.creating
    }
  }

  private async createLease() {
    this.creating++
    try {
      const context = await this.browser.newContext()
      const page = await context.newPage()
      const lease: PlaywrightLease = { page, context, contextId: `ctx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}` }
      this.current++
      this.available.push(lease)
    } catch (error) {
      log.warn('[crawler.pool] context init failed', { error: (error as Error)?.message || String(error) })
    } finally {
      this.creating--
    }
  }

  private async ensureCapacity() {
    if (this.destroyed) return
    while (this.current + this.creating < this.max) {
      await this.createLease()
      if (this.destroyed) return
    }
    this.flush()
  }

  private flush() {
    while (this.pending.length && this.available.length) {
      const resolver = this.pending.shift()!
      resolver(this.available.shift()!)
    }
  }

  async acquire(): Promise<PlaywrightLease | null> {
    if (this.destroyed) return null
    if (this.available.length) {
      const lease = this.available.shift()!
      this.activeLeases.add(lease)
      this.flush()
      return lease
    }
    if (this.current + this.creating < this.max) {
      await this.ensureCapacity()
    }
    if (this.available.length) {
      const lease = this.available.shift()!
      this.activeLeases.add(lease)
      this.flush()
      return lease
    }
    return await new Promise<PlaywrightLease | null>((resolve) => {
      if (this.destroyed) {
        resolve(null)
        return
      }
      this.pending.push((lease) => {
        if (!lease) {
          resolve(null)
          return
        }
        this.activeLeases.add(lease)
        resolve(lease)
      })
      void this.ensureCapacity()
    })
  }

  async release(lease: PlaywrightLease) {
    if (this.activeLeases.has(lease)) this.activeLeases.delete(lease)
    if (this.destroyed) {
      await this.disposeLease(lease, true)
      return
    }
    let healthy = true
    try {
      if (lease.page.isClosed?.()) healthy = false
    } catch {
      healthy = false
    }
    if (healthy) {
      try {
        await lease.page.goto('about:blank').catch(() => {})
        await lease.context.clearCookies?.().catch(() => {})
      } catch {
        healthy = false
      }
    }
    if (!healthy) {
      await this.disposeLease(lease, true)
      await this.ensureCapacity()
      return
    }
    this.available.push(lease)
    this.flush()
  }

  private async disposeLease(lease: PlaywrightLease, decrement = false) {
    try { await lease.page.close({ runBeforeUnload: true }) } catch {}
    try { await lease.context.close() } catch {}
    if (decrement) {
      this.current = Math.max(0, this.current - 1)
    }
  }

  async destroy() {
    this.destroyed = true
    for (const resolver of this.pending) resolver(null)
    this.pending = []
    for (const lease of this.available.splice(0)) {
      await this.disposeLease(lease, true)
    }
    for (const lease of Array.from(this.activeLeases)) {
      await this.disposeLease(lease, true)
      this.activeLeases.delete(lease)
    }
    this.current = 0
  }
}

type SeedSource = 'anchor' | 'prefetch' | 'sitemap' | 'heuristic'

const FALLBACK_PATHS = ['/pricing', '/features', '/plans', '/solutions', '/customers', '/case-studies', '/blog', '/resources', '/about', '/contact', '/faq', '/terms', '/privacy', '/careers', '/docs', '/support']

export async function processCrawl(payload: { websiteId?: string; projectId?: string }) {
  const websiteId = String(payload.websiteId || payload.projectId)
  const site = await websitesRepo.get(websiteId)
  if (!site?.url) { log.warn('[crawler] missing url; skipping', { websiteId }); return }
  try { await websitesRepo.patch(websiteId, { status: 'crawling' }) } catch {}

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
  let contextPool: PlaywrightContextPool | null = null
  if (usePlaywright) {
    try {
      browser = await chromium.launch({ headless: true })
      contextPool = await PlaywrightContextPool.create({ browser, max: Math.max(1, env.crawlConcurrency || 1) })
      log.info('[crawler] using playwright rendering', { concurrency: contextPool.size })
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
  const crawlStartedAt = new Date().toISOString()
  const initialStats = contextPool?.stats()
  publishDashboardProgress(websiteId, {
    crawlProgress: {
      crawledCount: 0,
      targetCount: visitLimit,
      startedAt: crawlStartedAt,
      completedAt: null
    },
    crawlStatus: 'running',
    crawlCooldownExpiresAt: null,
    lastCrawlAt: crawlStartedAt,
    playwrightWorkers: initialStats ? { active: initialStats.active, max: initialStats.max } : undefined
  })

  log.info('[crawler] seeds', { count: initialSeeds.length })
  const crawlConcurrency = Math.max(1, env.crawlConcurrency || 4)

  const visitNode = async ({ url, depth }: { url: string; depth: number }) => {
    if (seen.size >= visitLimit) return
    if (seen.has(url)) return
    if (depth > maxDepth) return
    log.debug('[crawler] visiting', { websiteId, url, depth })
    let httpStatus: number | null = null
    let title = ''
    let headings: Array<{ level: number; text: string }> = []
    let linksForJson: Array<{ href: string; text?: string }> = []
    let pageHtml: string | null = null
    let textDump: string | null = null
    let contentBlobUrl: string | null = null

    const runWithPlaywright = async () => {
      if (!contextPool) return false
      const requestedAt = Date.now()
      const lease = await contextPool.acquire()
      if (!lease) return false
      const waitedMs = Date.now() - requestedAt
      if (waitedMs > 50) {
        log.debug('[crawler] playwright lease wait', { websiteId, url, waitedMs, stats: contextPool.stats() })
      }
      try {
        const { page } = lease
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
        return true
      } catch (error) {
        log.warn('[crawler] playwright visit failed', { websiteId, url, error: (error as Error)?.message })
        return false
      } finally {
        await contextPool.release(lease)
      }
    }

    try {
      // no in-progress row; persist only finalized page rows (DB-only)
      let usedPlaywright = false
      if (usePlaywright && contextPool) {
        usedPlaywright = await runWithPlaywright()
      }
      if (!usedPlaywright) {
        try {
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
        } catch (error) {
          log.warn('[crawler] fetch visit failed', { websiteId, url, error: (error as Error)?.message })
          return
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
      if (seen.size >= visitLimit) return
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
      if (seen.size >= visitLimit) return
      await crawlRepo.recordPage({ websiteId, jobId, url, httpStatus: httpStatus ?? null, title, content: (title ? title + '\n\n' : '') + (textDump || pageHtml || ''), summary: pageSummary })
      log.debug('[crawler] stored page', { websiteId, url, depth, httpStatus })
      nodes.set(url, { url, title })
      if (linksForJson.length) {
        for (const link of linksForJson.slice(0, 50)) {
          edges.push({ from: url, to: link.href, text: link.text || null })
        }
      }
      seen.add(url)
      const poolStats = contextPool?.stats()
      publishDashboardProgress(websiteId, {
        crawlProgress: {
          crawledCount: seen.size,
          targetCount: visitLimit,
          startedAt: crawlStartedAt,
          completedAt: null
        },
        crawlStatus: 'running',
        crawlCooldownExpiresAt: null,
        lastCrawlAt: crawlStartedAt,
        playwrightWorkers: poolStats ? { active: poolStats.active, max: poolStats.max } : undefined
      })
    } catch {}
  }

  while (queue.length > 0 && seen.size < visitLimit) {
    const batch = queue.splice(0, crawlConcurrency)
    await Promise.all(batch.map((node) => visitNode(node)))
  }

  const finalStats = (contextPool?.stats?.() as { active?: number; max?: number } | null) || null
  if (contextPool) {
    await contextPool.destroy()
    contextPool = null
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
  const crawlCompletedAt = new Date().toISOString()
  const nextEligible = computeNextEligible(crawlCompletedAt, env.crawlCooldownHours)
  publishDashboardProgress(websiteId, {
    crawlProgress: {
      crawledCount: seen.size,
      targetCount: visitLimit,
      startedAt: crawlStartedAt,
      completedAt: crawlCompletedAt
    },
    crawlStatus: nextEligible ? 'cooldown' : 'idle',
    crawlCooldownExpiresAt: nextEligible,
    lastCrawlAt: crawlStartedAt,
    playwrightWorkers: finalStats
      ? {
          active: Number.isFinite(finalStats.active ?? NaN) ? Number(finalStats.active) : 0,
          max: Number.isFinite(finalStats.max ?? NaN) ? Number(finalStats.max) : 0
        }
      : undefined
  })
  try { await crawlRepo.completeJob(jobId) } catch {}
  try { await websitesRepo.patch(websiteId, { status: 'crawled' }) } catch {}
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

function computeNextEligible(referenceIso: string | null, cooldownHours: number): string | null {
  if (!referenceIso) return null
  if (!Number.isFinite(cooldownHours) || cooldownHours <= 0) return null
  const base = new Date(referenceIso)
  if (Number.isNaN(base.getTime())) return null
  const target = base.getTime() + cooldownHours * 60 * 60 * 1000
  if (target <= Date.now()) return null
  return new Date(target).toISOString()
}
