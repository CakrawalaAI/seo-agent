import type { CrawlPage } from './domain/page'

const byProject = new Map<string, CrawlPage[]>()

export const crawlRepo = {
  list(projectId: string, limit = 100): CrawlPage[] {
    const all = byProject.get(projectId) ?? []
    return all.slice(0, limit)
  },
  seedRun(projectId: string): { jobId: string; added: number } {
    const now = new Date().toISOString()
    const sample: CrawlPage[] = [
      mkPage(projectId, '/', 0, 200, 'Home page'),
      mkPage(projectId, '/about', 1, 200, 'About us'),
      mkPage(projectId, '/blog', 1, 200, 'Blog')
    ]
    for (const p of sample) {
      p.extractedAt = now
    }
    const current = byProject.get(projectId) ?? []
    byProject.set(projectId, dedupe([...
      sample,
      ...current
    ]))
    return { jobId: genId('crawl'), added: sample.length }
  }
}

function mkPage(
  projectId: string,
  path: string,
  depth: number,
  httpStatus: number,
  title: string
): CrawlPage {
  const url = `https://example.com${path}`
  return {
    id: genId('page'),
    projectId,
    url,
    depth,
    httpStatus,
    status: 'completed',
    metaJson: { title },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
}

function genId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function dedupe(items: CrawlPage[]) {
  const seen = new Set<string>()
  const out: CrawlPage[] = []
  for (const p of items) {
    const key = p.url
    if (seen.has(key)) continue
    seen.add(key)
    out.push(p)
  }
  return out
}

