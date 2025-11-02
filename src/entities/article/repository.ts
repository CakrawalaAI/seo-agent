import type { Article, ArticleOutlineSection } from './domain/article'
import { hasDatabase, getDb } from '@common/infra/db'
import { articles } from './db/schema'
import { desc, eq } from 'drizzle-orm'

export const articlesRepo = {
  async list(projectId: string, limit = 90): Promise<Article[]> {
    if (!hasDatabase()) return []
    const db = getDb()
    // @ts-ignore
    const rows = await db.select().from(articles).where(eq(articles.projectId as any, projectId)).orderBy(desc(articles.createdAt)).limit(limit)
    return rows as any
  },
  async get(id: string): Promise<Article | null> {
    if (!hasDatabase()) return null
    const db = getDb()
    const rows = await db.select().from(articles).where(eq(articles.id, id)).limit(1)
    return (rows?.[0] as any) ?? null
  },
  async createDraft(input: { projectId: string; planItemId: string; title: string; outline?: ArticleOutlineSection[] }): Promise<Article> {
    const now = new Date()
    const targetId = input.planItemId
    // If a planned article exists with id = planItemId, convert it into a draft in place
    if (hasDatabase()) {
      const db = getDb()
      try {
        const rows = (await db.select().from(articles).where(eq(articles.id, targetId)).limit(1)) as any[]
        const found = rows?.[0]
        if (found) {
          await db
            .update(articles)
            .set({
              title: input.title,
              outlineJson: (input.outline ?? []) as any,
              status: 'draft' as any,
              bufferStage: 'draft' as any,
              language: 'en',
              tone: 'neutral',
              updatedAt: now as any
            })
            .where(eq(articles.id, targetId))
          const after = await db.select().from(articles).where(eq(articles.id, targetId)).limit(1)
          return (after?.[0] as any) as Article
        }
      } catch {}
    }

    // No org_usage gating; entitlements may be shown but not enforced

    const articleId = targetId || genId('article')
    const article: Article = {
      id: articleId,
      projectId: input.projectId,
      title: input.title,
      language: 'en',
      tone: 'neutral',
      status: 'draft',
      outlineJson: input.outline ?? [],
      bodyHtml: `<article><h1>${escapeHtml(input.title)}</h1><p>Generated draft body...</p></article>`,
      bufferStage: 'draft',
      generationDate: undefined as any,
      createdAt: undefined as any,
      updatedAt: undefined as any
    }
    if (hasDatabase()) {
      const db = getDb()
      await db
        .insert(articles)
        .values({
          id: article.id,
          projectId: article.projectId,
          title: article.title,
          language: article.language,
          tone: article.tone,
          status: article.status as any,
          bufferStage: article.bufferStage as any,
          outlineJson: article.outlineJson as any,
          bodyHtml: article.bodyHtml
        } as any)
        .onConflictDoNothing?.()
      // No usage increment; org_usage removed
    }
    return article
  },
  async update(id: string, patch: Partial<Article>): Promise<Article | null> {
    if (!hasDatabase()) return null
    const db = getDb()
    const set: any = { updatedAt: new Date() as any }
    for (const k of ['projectId','keywordId','plannedDate','title','language','tone','status','bufferStage','outlineJson','bodyHtml','generationDate','publishDate','url'] as const) {
      const v = (patch as any)[k]
      if (v !== undefined) set[k] = v as any
    }
    await db.update(articles).set(set).where(eq(articles.id, id))
    const rows = await db.select().from(articles).where(eq(articles.id, id)).limit(1)
    return (rows?.[0] as any) ?? null
  },
  async removeByProject(projectId: string) {
    if (!hasDatabase()) return
    const db = getDb()
    await db.delete(articles).where(eq(articles.projectId, projectId))
  }
}

function genId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function escapeHtml(input: string) {
  return input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
