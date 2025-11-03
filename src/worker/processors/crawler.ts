import { projectsRepo } from '@entities/project/repository'
import { crawlRepo } from '@entities/crawl/repository'
import { discoverFromSitemap, fetchAndParseSitemapUrls } from '@common/crawl/sitemap'
// robots intentionally ignored per config (owner consent)
import { env } from '@common/infra/env'
// bundle writes avoided when DB present; keep import only if needed for dev fallback
// import * as bundle from '@common/bundle/store'
import { createHash } from 'node:crypto'
import { config } from '@common/config'
import { getLlmProvider } from '@common/providers/registry'
import { summarizeSite } from '@common/providers/llm'
import { projectDiscoveryRepo } from '@entities/project/discovery/repository'
import { getDevFlags } from '@common/dev/flags'
import { log } from '@src/common/logger'

export async function processCrawl(payload: { projectId: string }) {
  const project = await projectsRepo.get(payload.projectId)
  if (!project?.siteUrl) {
    log.warn('[crawler] missing siteUrl; skipping', { projectId: payload.projectId })
    return
  }
  const siteUrl = project.siteUrl!
  const crawlBudget = 100
  log.info('[crawler] start', { projectId: payload.projectId, siteUrl, render: env.crawlRender })

  // Check if we should use mock crawler
  const flags = getDevFlags()
  if (flags.mocks.crawl) {
    log.info('[crawler] Using mock crawler (dev mock enabled)')
    const { generateMockCrawl } = await import('@common/providers/impl/mock/crawler')
    const mockResult = generateMockCrawl(payload.projectId, crawlBudget)

    for (const page of mockResult.pages) {
      crawlRepo.addOrUpdate(payload.projectId, page)
    }

    log.info('[crawler] Mock crawl complete', {
      projectId: payload.projectId,
      pagesGenerated: mockResult.urlsVisited
    })
    return
  }

  // 1) SIMPLE MODE: sitemap raw → cleaned URLs → LLM picks top 100 (or fewer)
  let reps: string[] = []
  try {
    const cleaned = await fetchAndParseSitemapUrls(project.siteUrl, 100000)
    log.info('[crawler] sitemap parsed', { total: cleaned.length })
    const listString = cleaned.join('\n')
    const llm = getLlmProvider()
    if (typeof (llm as any).pickTopFromSitemapString === 'function') {
      log.info('[crawler] LLM pickTop start', { requested: crawlBudget })
      const pickWithTimeout = async () => (llm as any).pickTopFromSitemapString(siteUrl, listString, crawlBudget)
      const picked: string[] = await Promise.race([
        pickWithTimeout(),
        new Promise<string[]>((resolve) => setTimeout(() => resolve([]), 20000))
      ])
      if (Array.isArray(picked) && picked.length) reps = picked.slice(0, crawlBudget)
      else log.warn('[crawler] LLM pickTop timeout/fallback; using first URLs')
    }
    if (!reps.length) reps = cleaned.slice(0, crawlBudget)
  } catch {
    // Fallback to the older limited sitemap discover
    const candidates = await discoverFromSitemap(project.siteUrl, crawlBudget)
    reps = candidates.slice(0, crawlBudget)
  }
  log.info('[crawler] representatives selected', { count: reps.length })
  const initialSeeds = reps.map((u) => ({ url: u, depth: 0 }))
  // Record representatives in DB discovery log for snapshot/overview
  try {
    const at = new Date().toISOString()
    await projectDiscoveryRepo.recordRun({ projectId: project.id, providersUsed: ['crawl'], crawlDigest: { at, urls: reps } })
  } catch {}

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

  const visitLimit = Math.max(1, reps.length || crawlBudget)
  const maxDepth = 0 // simple mode: no link expansion
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

      // record in-progress for live UI
      try {
        const now = new Date().toISOString()
        crawlRepo.recordPage(project.id, {
          id: pageIdFor(url),
          projectId: project.id,
          url,
          depth,
          httpStatus: null,
          status: 'in_progress',
          extractedAt: now,
          metaJson: { title: '' },
          headingsJson: [],
          linksJson: [],
          contentText: null,
          createdAt: now,
          updatedAt: now
        })
      } catch {}
      if (usePlaywright && page) {
        const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
        httpStatus = res?.status() ?? null
        title = await page.title().catch(() => '')
        try { pageHtml = await page.content() } catch {}
        try { textDump = await page.evaluate(() => document.body?.innerText || '') } catch {}
        // discover more links (same host)
        const anchors = await page.$$eval('a[href]', (els: any[]) =>
          els.map((a: any) => ({
            href: (a as HTMLAnchorElement).getAttribute('href') || '',
            text: (a as HTMLAnchorElement).textContent || ''
          }))
        )
        const base = new URL(url)
        for (const anchor of anchors) {
          const href = anchor.href
          try {
            const u = new URL(href, base)
            if (u.host === base.host && (u.protocol === 'http:' || u.protocol === 'https:')) {
              queue.push({ url: u.toString(), depth: depth + 1 })
              linksForJson.push({ href: u.toString(), text: anchor.text?.trim() || undefined })
            }
          } catch {}
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
        for (const match of hrefs) {
          const href = match[1] || ''
          const linkText = (match[2] || '').replace(/<[^>]+>/g, '').trim()
          try {
            const u = new URL(href, base)
            if (u.host === base.host && (u.protocol === 'http:' || u.protocol === 'https:')) {
              queue.push({ url: u.toString(), depth: depth + 1 })
              linksForJson.push({ href: u.toString(), text: linkText || undefined })
            }
          } catch {}
        }
        const headingMatches = Array.from(text.matchAll(/<(h[1-3])[^>]*>(.*?)<\/\1>/gis))
        headings = headingMatches.map((hm) => ({ level: Number(hm[1]!.slice(1)), text: (hm[2] || '').replace(/<[^>]+>/g, '').trim() }))
      }
      const now = new Date().toISOString()
      // No file storage: keep contentBlobUrl null (DB-only storage)
      const pageId = pageIdFor(url)
      crawlRepo.recordPage(project.id, {
        id: pageId,
        projectId: project.id,
        url,
        depth,
        httpStatus: httpStatus ?? undefined,
        status: 'completed',
        extractedAt: now,
        metaJson: { title },
        headingsJson: headings,
        linksJson: linksForJson,
        contentText: textDump || pageHtml || null,
        contentBlobUrl,
        createdAt: now,
        updatedAt: now
      })
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

  // 3) Build one big dump string (no per-page cap), then summarize within model context budget
  try {
    const pages = await crawlRepo.list(project.id, Math.max(200, reps.length || crawlBudget))
    const sections = pages.map((p) => {
      const title = ((p.metaJson as any)?.title as string | undefined) || ''
      const heads = Array.isArray(p.headingsJson)
        ? (p.headingsJson as Array<{ level: number; text: string }>).map((h) => `H${h.level}: ${h.text}`).join('\n')
        : ''
      const body = p.contentText || ''
      return `=== URL: ${p.url} | Title: ${title} ===\n${heads}\n${body}\n\n`
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
      // Fallback to older JSON summarizer using first 50 pages
      const summaryInput = pages.slice(0, 50).map((p) => ({ url: p.url, text: p.contentText || '' }))
      const jsonSummary = await summarizeSite(summaryInput).catch(() => null)
      businessSummary = jsonSummary?.businessSummary || (dump.slice(0, 2000) + ' ...')
    }

    await projectsRepo.patch(project.id, {
      businessSummary,
      workflowState: 'pending_summary_approval',
      discoveryApproved: false,
      planningApproved: false
    })
    // No summary file in DB-only mode
  } catch (err) {
    log.warn('[crawler] failed to summarize site', { error: (err as Error)?.message || String(err) })
  }
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
