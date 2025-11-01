import type { CrawlPage } from './domain/page'
import { appendJsonl, writeJson, latestRunDir } from '@common/bundle/store'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const PAGES_FILE = 'crawl/pages.jsonl'
const LINK_GRAPH_FILE = 'crawl/link-graph.json'

type LinkGraph = {
  nodes: Array<{ url: string; title?: string | null }>
  edges: Array<{ from: string; to: string; text?: string | null }>
}

export const crawlRepo = {
  async list(projectId: string, limit = 100): Promise<CrawlPage[]> {
    try {
      const base = latestRunDir(projectId)
      const file = join(base, PAGES_FILE)
      if (!existsSync(file)) return []
      const lines = readFileSync(file, 'utf-8').trim().split('\n').filter(Boolean)
      const slice = lines.slice(-limit)
      return slice.map((line) => JSON.parse(line) as CrawlPage)
    } catch (err) {
      console.warn('[crawlRepo] list failed', { projectId, error: (err as Error)?.message || String(err) })
      return []
    }
  },

  recordPage(projectId: string, page: CrawlPage) {
    try {
      appendJsonl(projectId, PAGES_FILE, page)
    } catch (err) {
      console.warn('[crawlRepo] recordPage failed', { projectId, url: page.url, error: (err as Error)?.message || String(err) })
    }
  },

  writeLinkGraph(projectId: string, graph: LinkGraph) {
    try {
      writeJson(projectId, LINK_GRAPH_FILE, graph)
    } catch (err) {
      console.warn('[crawlRepo] writeLinkGraph failed', { projectId, error: (err as Error)?.message || String(err) })
    }
  },

  addOrUpdate(projectId: string, page: Omit<CrawlPage, 'id' | 'projectId'> & { id?: string }): CrawlPage {
    const now = page.extractedAt || new Date().toISOString()
    const id = page.id || `page_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`
    const record: CrawlPage = {
      id,
      projectId,
      url: page.url,
      depth: page.depth ?? null,
      httpStatus: page.httpStatus ?? null,
      status: page.status ?? 'completed',
      extractedAt: String(now),
      metaJson: page.metaJson ?? null,
      headingsJson: page.headingsJson ?? null,
      linksJson: page.linksJson ?? null,
      contentBlobUrl: page.contentBlobUrl ?? null,
      contentText: page.contentText ?? null,
      createdAt: page.createdAt ?? now,
      updatedAt: page.updatedAt ?? now
    }
    this.recordPage(projectId, record)
    try {
      const graph = readLinkGraph(projectId)
      const nodes = new Map<string, { url: string; title?: string | null }>(graph.nodes.map((n) => [String(n.url), { url: String(n.url), title: n.title ?? null }]))
      const edgesSet = new Set<string>(graph.edges.map((e) => `${e.from}->${e.to}`))
      nodes.set(record.url, { url: record.url, title: (record.metaJson as any)?.title ?? null })
      const newEdges: Array<{ from: string; to: string; text?: string | null }> = []
      const links = Array.isArray(record.linksJson) ? record.linksJson : []
      for (const link of links.slice(0, 50)) {
        const target = String((link as any)?.href || '')
        if (!target) continue
        const key = `${record.url}->${target}`
        if (edgesSet.has(key)) continue
        edgesSet.add(key)
        newEdges.push({ from: record.url, to: target, text: (link as any)?.text ?? null })
      }
      this.writeLinkGraph(projectId, {
        nodes: Array.from(nodes.values()),
        edges: [...graph.edges, ...newEdges]
      })
    } catch (err) {
      console.warn('[crawlRepo] link graph update failed', { projectId, error: (err as Error)?.message || String(err) })
    }
    return record
  },

  async seedRun(projectId: string): Promise<{ jobId: string; added: number }> {
    // For queue-disabled local dev, just log stub crawl results and return
    const now = new Date().toISOString()
    const demo: CrawlPage[] = [
      { id: `seed_${projectId}_home`, projectId, url: 'https://example.com/', depth: 0, httpStatus: 200, status: 'completed', contentText: 'Example home', extractedAt: now },
      { id: `seed_${projectId}_about`, projectId, url: 'https://example.com/about', depth: 1, httpStatus: 200, status: 'completed', contentText: 'About page', extractedAt: now }
    ]
    for (const page of demo) this.recordPage(projectId, page)
    return { jobId: `crawl_${projectId}_${Date.now().toString(36)}`, added: demo.length }
  }
}

function readLinkGraph(projectId: string): LinkGraph {
  try {
    const base = latestRunDir(projectId)
    const file = join(base, LINK_GRAPH_FILE)
    if (!existsSync(file)) {
      return { nodes: [], edges: [] }
    }
    const raw = readFileSync(file, 'utf-8')
    const parsed = JSON.parse(raw)
    return {
      nodes: Array.isArray(parsed?.nodes)
        ? parsed.nodes.map((n: any) => ({ url: String(n?.url || ''), title: typeof n?.title === 'string' ? n.title : null })).filter((n: any) => n.url)
        : [],
      edges: Array.isArray(parsed?.edges)
        ? parsed.edges.map((e: any) => ({
            from: String(e?.from || e?.source || ''),
            to: String(e?.to || e?.target || ''),
            text: typeof e?.text === 'string' ? e.text : typeof e?.anchorText === 'string' ? e.anchorText : null
          })).filter((e: any) => e.from && e.to)
        : []
    }
  } catch {
    return { nodes: [], edges: [] }
  }
}
