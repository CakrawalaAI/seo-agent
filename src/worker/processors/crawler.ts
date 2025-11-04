import { websitesRepo } from '@entities/website/repository'
import { websiteCrawlRepo } from '@entities/crawl/repository.website'
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
// discovery persistence removed; summary written to websites
import { getDevFlags } from '@common/dev/flags'
import { log } from '@src/common/logger'

export async function processCrawl(payload: { websiteId?: string; projectId?: string }) {
  const websiteId = String(payload.websiteId || payload.projectId)
  const site = await websitesRepo.get(websiteId)
  if (!site?.url) { log.warn('[crawler] missing url; skipping', { websiteId }); return }
  const siteUrl = site.url!
  const crawlBudget = Math.max(1, env.crawlBudgetPages || 50)
  log.info('[crawler] start', { websiteId, siteUrl, render: env.crawlRender })

  // Check if we should use mock crawler
  const flags = getDevFlags()
  if (flags.mocks.crawl) {
    log.info('[crawler] Using mock crawler (dev mock enabled)')
    const { generateMockCrawl } = await import('@common/providers/impl/mock/crawler')
    const mockResult = generateMockCrawl(websiteId, crawlBudget)
    const runId = (await websiteCrawlRepo.startRun(websiteId))!
    for (const page of mockResult.pages) {
      const statusVal = typeof page.httpStatus === 'number' ? page.httpStatus : (Number.isFinite(Number(page.httpStatus)) ? Number(page.httpStatus) : null)
      const title = ((page as any)?.metaJson?.title as string | undefined) || (page as any)?.title || ''
      const content = (title ? title + '\n\n' : '') + String((page as any)?.contentText || '')
      const summary = content.replace(/\s+/g, ' ').slice(0, 360)
      await websiteCrawlRepo.recordPage({ websiteId, runId, url: page.url, httpStatus: statusVal, title, content, summary })
    }
    await websiteCrawlRepo.completeRun(runId)
    log.info('[crawler] Mock crawl complete', { websiteId, pagesGenerated: mockResult.urlsVisited })
    return
  }

  // Seeds: landing page only (BFS), optional sitemap top-ups when few links found
  const initialSeeds = [{ url: siteUrl, depth: 0 }]
  const runId = (await websiteCrawlRepo.startRun(websiteId))!

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
  const nodes = new Map<string, { url: string; title?: string | null }>()
  const edges: Array<{ from: string; to: string; text?: string | null }> = []
  const queue: Array<{ url: string; depth: number }> = [...initialSeeds]
  log.info('[crawler] seeds', { count: initialSeeds.length })
  for (let qi = 0; qi < queue.length && seen.size < visitLimit; qi++) {
    const { url, depth } = queue[qi]!
    if (seen.has(url)) continue
    if (depth > maxDepth) continue
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
        title = await page.title().catch(() => '')
        try { pageHtml = await page.content() } catch {}
        try { textDump = await page.evaluate(() => document.body?.innerText || '') } catch {}
        // discover links; limit breadth per node
        const anchors = await page.$$eval('a[href]', (els: any[]) =>
          els.map((a: any) => ({ href: (a as HTMLAnchorElement).getAttribute('href') || '', text: (a as HTMLAnchorElement).textContent || '' }))
        )
        const base = new URL(url)
        let added = 0
        for (const anchor of anchors) {
          if (added >= maxBreadth) break
          const norm = normalizeUrl(anchor.href, base)
          if (!norm || !isHtmlLike(norm)) continue
          if (new URL(norm).host !== base.host) continue
          if (!seen.has(norm) && !queue.some((q) => q.url === norm)) {
            queue.push({ url: norm, depth: depth + 1 })
            linksForJson.push({ href: norm, text: anchor.text?.trim() || undefined })
            added++
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
        let added = 0
        for (const match of hrefs) {
          if (added >= maxBreadth) break
          const href = match[1] || ''
          const linkText = (match[2] || '').replace(/<[^>]+>/g, '').trim()
          const norm = normalizeUrl(href, base)
          if (!norm || !isHtmlLike(norm)) continue
          if (new URL(norm).host !== base.host) continue
          if (!seen.has(norm) && !queue.some((q) => q.url === norm)) {
            queue.push({ url: norm, depth: depth + 1 })
            linksForJson.push({ href: norm, text: linkText || undefined })
            added++
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
      await websiteCrawlRepo.recordPage({ websiteId, runId, url, httpStatus: httpStatus ?? null, title, content: (title ? title + '\n\n' : '') + (textDump || pageHtml || ''), summary: pageSummary })
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

  // 3) Build one big text of per-page summaries, then summarize within model context budget
  try {
    const pages = await websiteCrawlRepo.listRecentPages(websiteId, Math.max(200, crawlBudget))
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
    // No summary file in DB-only mode
  } catch (err) {
    log.warn('[crawler] failed to summarize site', { error: (err as Error)?.message || String(err) })
  }
  try { await websiteCrawlRepo.completeRun(runId) } catch {}
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
