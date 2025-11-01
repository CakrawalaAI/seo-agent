import { projectsRepo } from '@entities/project/repository'
import { crawlRepo } from '@entities/crawl/repository'
import { discoverFromSitemap } from '@common/crawl/sitemap'
// robots intentionally ignored per config (owner consent)
import { env } from '@common/infra/env'
import * as bundle from '@common/bundle/store'
import { createHash } from 'node:crypto'
import { hasDatabase, getDb } from '@common/infra/db'
import { projects as projectsTable } from '@entities/project/db/schema'
import { eq } from 'drizzle-orm'
import { linkGraph, crawlPages } from '@entities/crawl/db/schema'
import { config } from '@common/config'
import { getLlmProvider } from '@common/providers/registry'

export async function processCrawl(payload: { projectId: string }) {
  let project = await projectsRepo.get(payload.projectId) as any
  if (!project && hasDatabase()) {
    try {
      const db = getDb()
      const rows = (await (db.select().from(projectsTable).where(eq(projectsTable.id, payload.projectId)).limit(1) as any)) as any
      project = rows?.[0] ?? null
      if (!project) console.warn('[crawler] project not found in DB', { projectId: payload.projectId })
    } catch (err) {
      console.warn('[crawler] failed to load project from DB', { projectId: payload.projectId, error: (err as Error)?.message || String(err) })
    }
  }
  if (!project?.siteUrl) {
    console.warn('[crawler] missing siteUrl; skipping', { projectId: payload.projectId })
    return
  }
  console.info('[crawler] start', { projectId: payload.projectId, siteUrl: project.siteUrl, render: env.crawlRender })

  // 1) Gather candidates from sitemap (larger set), then let LLM pick representatives
  const candidates = await discoverFromSitemap(project.siteUrl, 200)
  const reps = await (async () => {
    try {
      const llm = getLlmProvider()
      if (typeof (llm as any).rankRepresentatives === 'function') {
        // @ts-ignore
        const ranked: string[] = await (llm as any).rankRepresentatives(project.siteUrl, candidates, config.crawl.maxRepresentatives)
        if (Array.isArray(ranked) && ranked.length) return ranked.slice(0, config.crawl.maxRepresentatives)
      }
    } catch {}
    // Fallback heuristics
    const set = new Set<string>()
    const push = (p: string) => { try { set.add(new URL(p, project.siteUrl).toString()) } catch {} }
    push('/')
    push('/about')
    push('/pricing')
    push('/blog')
    for (const u of candidates) if (set.size < config.crawl.maxRepresentatives) set.add(u)
    return Array.from(set)
  })()
  // Persist chosen reps on project for transparency
  if (hasDatabase()) {
    // representativeUrlsJson removed; no DB persistence
  }
  console.info('[crawler] representatives selected', { count: reps.length, urls: reps })
  const initialSeeds = reps.map((u) => ({ url: u, depth: 0 }))
  // Write representatives to debug bundle for snapshot/overview (stateless workers)
  try {
    const at = new Date().toISOString()
    bundle.writeJson(String(payload.projectId), 'crawl/representatives.json', { at, urls: reps })
    bundle.appendLineage(String(payload.projectId), { node: 'crawl', outputs: { representatives: reps.length } })
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
    console.warn('[crawler] playwright import failed; falling back to fetch', { error: (err as Error)?.message || String(err) })
  }

  let browser: any = null
  let page: any = null
  if (usePlaywright) {
    try {
      browser = await chromium.launch({ headless: true })
      const context = await browser.newContext()
      page = await context.newPage()
      console.info('[crawler] using playwright rendering')
    } catch (err) {
      usePlaywright = false
      console.warn('[crawler] playwright launch failed; falling back to fetch', { error: (err as Error)?.message || String(err) })
    }
  }

  const visitLimit = Math.max(1, config.crawl.maxRepresentatives * (1 + Math.max(0, config.crawl.expandDepth)))
  const maxDepth = Math.max(0, config.crawl.expandDepth)
  const seen = new Set<string>()
  const queue: Array<{ url: string; depth: number }> = [...initialSeeds]
  console.info('[crawler] seeds', { count: initialSeeds.length })
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
      crawlRepo.addOrUpdate(project.id, {
        url,
        depth: url === project.siteUrl ? 0 : 1,
        httpStatus: httpStatus ?? undefined,
        status: 'completed',
        metaJson: { title },
        headingsJson: headings,
        linksJson: linksForJson,
        contentBlobUrl: undefined,
        extractedAt: now
      })
      // Persist content/text directly in DB (stateless worker)
      if (hasDatabase()) {
        try {
          const db = getDb()
          const id = `page_${Math.random().toString(36).slice(2,10)}_${Date.now().toString(36)}`
          // upsert by projectId+url
          // @ts-ignore
          await db
            .insert(crawlPages)
            .values({ id, projectId: project.id, url, depth: depth, httpStatus: String(httpStatus || ''), status: 'completed', extractedAt: new Date(now) as any, metaJson: { title } as any, headingsJson: headings as any, linksJson: linksForJson as any, contentText: (textDump || pageHtml || '') as any })
            .onConflictDoUpdate?.({ target: [crawlPages.projectId, crawlPages.url], set: { depth: depth as any, httpStatus: String(httpStatus || ''), status: 'completed' as any, extractedAt: new Date(now) as any, metaJson: { title } as any, headingsJson: headings as any, linksJson: linksForJson as any, contentText: (textDump || pageHtml || '') as any, updatedAt: new Date() as any } })
        } catch {}
      }
      // Bundle writes skipped for stateless mode
      // Persist link edges when DB is available
      if (hasDatabase() && linksForJson.length) {
        try {
          const db = getDb()
          for (const l of linksForJson.slice(0, 50)) {
            const id = `edge_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`
            // @ts-ignore
            await db
              .insert(linkGraph)
              .values({ id, projectId: project.id, fromUrl: url, toUrl: l.href, anchorText: l.text ?? null })
              .onConflictDoNothing?.()
          }
        } catch {}
      }
      seen.add(url)
    } catch {}
  }

  if (usePlaywright && browser) {
    try { await browser.close() } catch {}
  }
  try { bundle.appendLineage(project.id, { node: 'crawl', outputs: { pages: seen.size } }) } catch {}
  console.info('[crawler] done', { visited: seen.size })
}
