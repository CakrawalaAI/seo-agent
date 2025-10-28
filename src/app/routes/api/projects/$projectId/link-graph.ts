// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError } from '@app/api-utils'
import { hasDatabase, getDb } from '@common/infra/db'
import { crawlPages, linkGraph } from '@entities/crawl/db/schema'
import { eq } from 'drizzle-orm'
import { crawlRepo } from '@entities/crawl/repository'

export const Route = createFileRoute('/api/projects/$projectId/link-graph')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const projectId = params.projectId
        const nodes: Array<{ id: string; url: string; title?: string | null }> = []
        const edges: Array<{ from: string; to: string; text?: string | null }> = []

        if (hasDatabase()) {
          try {
            const db = getDb()
            // Prefer dedicated linkGraph table
            // @ts-ignore
            const rows = (await db.select().from(linkGraph).where(eq(linkGraph.projectId, projectId)).limit(2000)) as any[]
            const urls = new Set<string>()
            for (const e of rows) {
              edges.push({ from: e.fromUrl, to: e.toUrl, text: e.anchorText ?? null })
              urls.add(e.fromUrl)
              urls.add(e.toUrl)
            }
            // Fetch titles for known urls from crawl_pages if available
            // @ts-ignore
            const pages = (await db.select().from(crawlPages).where(eq(crawlPages.projectId, projectId)).limit(1000)) as any[]
            const titleByUrl = new Map<string, string | null>()
            for (const p of pages) titleByUrl.set(p.url, p?.metaJson?.title ?? null)
            for (const u of Array.from(urls)) {
              nodes.push({ id: u, url: u, title: titleByUrl.get(u) ?? null })
            }
            if (nodes.length > 0 || edges.length > 0) return json({ nodes, edges })
            // else fall through to in-memory
          } catch {}
        }

        const pages = crawlRepo.list(projectId, 500)
        if (!pages.length) return json({ nodes, edges })
        for (const p of pages) {
          nodes.push({ id: p.id, url: p.url, title: p?.metaJson?.title as any })
          const links = Array.isArray((p as any).linksJson) ? (p as any).linksJson : []
          for (const l of links.slice(0, 50)) {
            edges.push({ from: p.url, to: l.href, text: l.text ?? null })
          }
        }
        return json({ nodes, edges })
      }
    }
  }
})
