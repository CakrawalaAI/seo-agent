import { getDb } from '../src/common/infra/db'
import { projects } from '../src/entities/project/db/schema'
import { crawlPages } from '../src/entities/crawl/db/schema'
import { keywords } from '../src/entities/keyword/db/schema'
// plan merged into articles (status='planned')
import { articles } from '../src/entities/article/db/schema'
import { eq, desc, asc, and } from 'drizzle-orm'
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

  const pageRows = await db
    .select()
    .from(crawlPages)
    .where(eq(crawlPages.projectId as any, projectId))
    .orderBy(desc(crawlPages.depth as any))
    .limit(50)
  console.log('crawl_pages', pageRows.length)
  const pages = pageRows.map((r: any) => ({ url: r.url, title: r?.metaJson?.title, text: r?.contentText || '' }))
  const summary = await summarizeSite(pages)
  console.log('summary.topicClusters', summary.topicClusters?.length || 0, summary.topicClusters)
  const seedsLlm = await expandSeeds(summary.topicClusters || [], proj.defaultLocale || 'en-US')
  console.log('expand.seedsLlm', seedsLlm.length)
  const allHeadings: Array<{ level: number; text: string }> = []
  for (const r of pageRows) {
    const hs = Array.isArray((r as any)?.headingsJson) ? (((r as any).headingsJson) as any[]) : []
    for (const h of hs) allHeadings.push({ level: Number(h.level || 2), text: String(h.text || '') })
  }
  const fromHeads = phrasesFromHeadings(allHeadings, 50)
  console.log('headings.phrases', fromHeads.length)

  const kwRows = await db.select().from(keywords).where(eq(keywords.projectId as any, projectId)).orderBy(desc(keywords.createdAt as any)).limit(10)
  console.log('keywords', kwRows.length, kwRows.map((k: any) => k.phrase))

  const planRows = await db
    .select()
    .from(articles)
    .where(and(eq(articles.projectId as any, projectId), eq(articles.status as any, 'planned' as any)))
    .orderBy(asc(articles.plannedDate as any))
    .limit(10)
  console.log('plan (articles)', planRows.length, planRows.map((p: any) => p.plannedDate))

  const artRows = await db.select().from(articles).where(eq(articles.projectId as any, projectId)).orderBy(desc(articles.createdAt as any)).limit(10)
  console.log('articles', artRows.length, artRows.map((a: any) => ({ id: a.id, status: a.status, title: a.title })))
}

main().catch((e) => { console.error(e); process.exit(1) })
