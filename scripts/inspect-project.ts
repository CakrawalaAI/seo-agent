import { getDb } from '../src/common/infra/db'
import { projects } from '../src/entities/project/db/schema'
import { eq, desc } from 'drizzle-orm'
import { crawlRepo } from '../src/entities/crawl/repository'
import { keywordsRepo } from '../src/entities/keyword/repository'
import { planRepo } from '../src/entities/plan/repository'
import { articlesRepo } from '../src/entities/article/repository'
import { summarizeSite, expandSeeds } from '../src/common/providers/llm'
import { phrasesFromHeadings } from '../src/features/keyword/server/fromHeadings'

async function main() {
  const db = getDb()
  const argId = process.argv[2]
  const proj = argId
    ? (await db.select().from(projects).where(eq(projects.id as any, argId)).limit(1))[0]
    : (await db.select().from(projects).orderBy(desc(projects.createdAt as any)).limit(1))[0]
  if (!proj) {
    console.log('no project found')
    return
  }
  const projectId = proj.id
  console.log('project', projectId, proj.siteUrl)

  const crawlPages = await crawlRepo.list(projectId, 200)
  console.log('crawl_pages (bundle)', crawlPages.length)
  const pages = crawlPages.slice(0, 50).map((p) => ({
    url: p.url,
    title: (p.metaJson as any)?.title,
    text: p.contentText || ''
  }))
  const summary = await summarizeSite(pages)
  console.log('summary.topicClusters', summary.topicClusters?.length || 0, summary.topicClusters)
  const seedsLlm = await expandSeeds(summary.topicClusters || [], proj.defaultLocale || 'en-US')
  console.log('expand.seedsLlm', seedsLlm.length)
  const allHeadings: Array<{ level: number; text: string }> = []
  for (const page of crawlPages.slice(0, 200)) {
    const hs = Array.isArray(page.headingsJson) ? (page.headingsJson as Array<{ level?: number; text?: string }>) : []
    for (const h of hs) allHeadings.push({ level: Number(h.level || 2), text: String(h.text || '') })
  }
  const fromHeads = phrasesFromHeadings(allHeadings, 50)
  console.log('headings.phrases', fromHeads.length)

  const kwRows = await keywordsRepo.list(projectId, { status: 'all', limit: 10 })
  console.log('keywords', kwRows.length, kwRows.map((k) => k.phrase))

  const planRows = await planRepo.list(projectId, 30)
  console.log('plan items', planRows.length, planRows.map((p) => ({ id: p.id, date: p.plannedDate, status: p.status })))

  const artRows = await articlesRepo.list(projectId, 10)
  console.log('articles', artRows.length, artRows.map((a) => ({ id: a.id, status: a.status, title: a.title })))
}

main().catch((e) => { console.error(e); process.exit(1) })
