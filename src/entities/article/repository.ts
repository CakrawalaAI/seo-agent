import type { Article, ArticleOutlineSection } from './domain/article'
import { hasDatabase, getDb } from '@common/infra/db'
import { articles } from './db/schema'
import { desc, eq } from 'drizzle-orm'

const byProject = new Map<string, Article[]>()
const byId = new Map<string, Article>()

export const articlesRepo = {
  list(projectId: string, limit = 90): Article[] {
    const all = byProject.get(projectId) ?? []
    const sorted = [...all].sort(
      (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
    )
    return sorted.slice(0, limit)
  },
  get(id: string): Article | null {
    return byId.get(id) ?? null
  },
  createDraft(input: {
    projectId: string
    planItemId: string
    title: string
    outline?: ArticleOutlineSection[]
  }): Article {
    const now = new Date().toISOString()
    const article: Article = {
      id: genId('article'),
      projectId: input.projectId,
      planItemId: input.planItemId,
      title: input.title,
      language: 'en',
      tone: 'neutral',
      status: 'draft',
      outlineJson: input.outline ?? [],
      bodyHtml: `<article><h1>${escapeHtml(input.title)}</h1><p>Generated draft body...</p></article>`,
      generationDate: now,
      createdAt: now,
      updatedAt: now
    }
    if (hasDatabase()) void (async () => { try { const db = getDb(); await db.insert(articles).values(article).onConflictDoNothing(); } catch {} })()
    const current = byProject.get(input.projectId) ?? []
    byProject.set(input.projectId, [article, ...current])
    byId.set(article.id, article)
    return article
  },
  update(id: string, patch: Partial<Article>): Article | null {
    const current = this.get(id)
    if (!current) return null
    const updated: Article = { ...current, ...patch, updatedAt: new Date().toISOString() }
    if (hasDatabase()) void (async () => { try { const db = getDb(); await db.update(articles).set(updated).where(eq(articles.id, id)); } catch {} })()
    byId.set(id, updated)
    const list = byProject.get(updated.projectId) ?? []
    const idx = list.findIndex((a) => a.id === id)
    if (idx >= 0) {
      list[idx] = updated
      byProject.set(updated.projectId, list)
    }
    return updated
  }
  ,
  removeByProject(projectId: string) {
    const list = byProject.get(projectId) ?? []
    for (const a of list) byId.delete(a.id)
    byProject.delete(projectId)
  }
}

function genId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function escapeHtml(input: string) {
  return input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
