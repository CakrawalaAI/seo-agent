import { projectsRepo } from '@entities/project/repository'
import { crawlRepo } from '@entities/crawl/repository'
import { discoverFromSitemap } from '@common/crawl/sitemap'
import { isAllowed } from '@common/crawl/robots'
import { saveHtml } from '@common/blob/store'
import { env } from '@common/infra/env'
import { hasDatabase, getDb } from '@common/infra/db'
import { projects as projectsTable } from '@entities/project/db/schema'
import { eq } from 'drizzle-orm'
import { linkGraph } from '@entities/crawl/db/schema'

export async function processCrawl(payload: { projectId: string }) {
  let project = projectsRepo.get(payload.projectId) as any
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

  // Try sitemap discovery first
  const discovered = await discoverFromSitemap(project.siteUrl, 10)
  const initialSeeds = (discovered.length > 0
    ? discovered
    : [
        project.siteUrl,
        new URL('/about', project.siteUrl).toString(),
        new URL('/blog', project.siteUrl).toString()
      ])
    .map((u) => ({ url: u, depth: 0 }))

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

  const visitLimit = Math.max(
    1,
    Math.min(500, Number((project as any)?.crawlBudgetPages ?? (env.crawlBudgetPages ?? 50)))
  )
  const maxDepth = Math.max(0, Number((project as any)?.crawlMaxDepth ?? (env.crawlMaxDepth ?? 2)))
  const seen = new Set<string>()
  const queue: Array<{ url: string; depth: number }> = [...initialSeeds]
  console.info('[crawler] seeds', { count: initialSeeds.length })
  for (let qi = 0; qi < queue.length && seen.size < visitLimit; qi++) {
    const { url, depth } = queue[qi]!
    if (seen.has(url)) continue
    if (!(await isAllowed(url))) continue
    if (depth > maxDepth) continue
    try {
      let httpStatus: number | null = null
      let title = ''
      let headings: Array<{ level: number; text: string }> = []
      let linksForJson: Array<{ href: string; text?: string }> = []
      let pageHtml: string | null = null
      if (usePlaywright && page) {
        const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
        httpStatus = res?.status() ?? null
        title = await page.title().catch(() => '')
        try { pageHtml = await page.content() } catch {}
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
      let contentBlobUrl: string | undefined
      if (pageHtml) {
        try {
          const blob = saveHtml(pageHtml, project.id)
          contentBlobUrl = blob.url
        } catch {}
      }
      crawlRepo.addOrUpdate(project.id, {
        url,
        depth: url === project.siteUrl ? 0 : 1,
        httpStatus: httpStatus ?? undefined,
        status: 'completed',
        metaJson: { title },
        headingsJson: headings,
        linksJson: linksForJson,
        contentBlobUrl,
        extractedAt: now
      })
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
  console.info('[crawler] done', { visited: seen.size })
}
