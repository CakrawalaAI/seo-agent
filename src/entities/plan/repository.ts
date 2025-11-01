import type { PlanItem } from './domain/plan-item'
import { clusterKey } from '@common/keyword/cluster'
import { hasDatabase, getDb } from '@common/infra/db'
import { keywords as keywordsTable } from '@entities/keyword/db/schema'
import { keywordCanon } from '@entities/keyword/db/schema.canon'
import { articles as articlesTable } from '@entities/article/db/schema'
import { eq, and, asc } from 'drizzle-orm'

export const planRepo = {
  async createPlan(projectId: string, days: number): Promise<{ jobId: string; created: number }> {
    const millisPerDay = 24 * 60 * 60 * 1000
    if (!hasDatabase()) return { jobId: genId('job'), created: 0 }
    const db = getDb()
    // Keywords ordered deterministically by canonical phrase
    const kws: any[] = await db
      .select({
        id: keywordsTable.id,
        phrase: keywordCanon.phraseNorm
      })
      .from(keywordsTable)
      .innerJoin(keywordCanon, eq(keywordsTable.canonId, keywordCanon.id))
      .where(eq(keywordsTable.projectId, projectId))
      .orderBy(asc(keywordCanon.phraseNorm))
      .limit(Math.max(1, days * 3))
    const unique: any[] = []
    const seenCluster = new Set<string>()
    for (const k of kws) {
      const ck = clusterKey(k.phrase)
      if (seenCluster.has(ck)) continue
      seenCluster.add(ck)
      unique.push(k)
      if (unique.length >= Math.max(1, days)) break
    }
    const baseDate = new Date()
    const items: PlanItem[] = []
    const values: any[] = []
    for (let idx = 0; idx < unique.length; idx++) {
      const kw = unique[idx] as any
      const plannedDate = new Date(baseDate.getTime() + idx * millisPerDay).toISOString().slice(0, 10)
      const id = genId('plan')
      items.push({
        id,
        projectId,
        keywordId: kw.id,
        title: kw.phrase,
        plannedDate,
        status: 'draft',
        outlineJson: null,
        createdAt: undefined as any,
        updatedAt: undefined as any
      })
      values.push({
        id,
        projectId,
        keywordId: kw.id,
        title: kw.phrase,
        plannedDate,
        status: 'draft'
      })
    }
    if (!values.length) return { jobId: genId('job'), created: 0 }
    await db.insert(articlesTable).values(values as any).onConflictDoNothing?.()
    return { jobId: genId('job'), created: values.length }
  },
  async list(projectId: string, limit = 90): Promise<PlanItem[]> {
    if (!hasDatabase()) return []
    const db = getDb()
    const rows = await db
      .select()
      .from(articlesTable)
      .where(and(eq(articlesTable.projectId, projectId), eq(articlesTable.status as any, 'draft' as any)))
      .orderBy(asc(articlesTable.plannedDate as any))
      .limit(limit)
    // Map Article -> PlanItem shape
    return (rows as any[]).map((r) => ({
      id: r.id,
      projectId: r.projectId,
      keywordId: r.keywordId ?? null,
      title: r.title ?? '',
      plannedDate: r.plannedDate ?? '',
      status: (r.status as any) ?? 'draft',
      outlineJson: (r as any).outlineJson ?? null,
      language: r.language ?? null,
      tone: r.tone ?? null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    })) as any
  },
  async updateDate(planItemId: string, plannedDate: string): Promise<PlanItem | null> {
    if (!hasDatabase()) return null
    const db = getDb()
    await db.update(articlesTable).set({ plannedDate, updatedAt: new Date() as any }).where(eq(articlesTable.id, planItemId))
    const rows = await db.select().from(articlesTable).where(eq(articlesTable.id, planItemId)).limit(1)
    const r: any = rows?.[0]
    if (!r) return null
    return {
      id: r.id,
      projectId: r.projectId,
      keywordId: r.keywordId,
      title: r.title,
      plannedDate: r.plannedDate,
      status: r.status,
      outlineJson: r.outlineJson,
      language: r.language,
      tone: r.tone,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    } as any
  },
  async updateFields(planItemId: string, patch: Partial<Pick<PlanItem, 'title' | 'outlineJson' | 'status'>>): Promise<PlanItem | null> {
    if (!hasDatabase()) return null
    const db = getDb()
    const set: any = { updatedAt: new Date() as any }
    if (typeof patch.title === 'string') set.title = patch.title
    if (patch.outlineJson) set.outlineJson = patch.outlineJson as any
    if (typeof patch.status === 'string') set.status = patch.status
    await db.update(articlesTable).set(set).where(eq(articlesTable.id, planItemId))
    const rows = await db.select().from(articlesTable).where(eq(articlesTable.id, planItemId)).limit(1)
    const r: any = rows?.[0]
    if (!r) return null
    return {
      id: r.id,
      projectId: r.projectId,
      keywordId: r.keywordId,
      title: r.title,
      plannedDate: r.plannedDate,
      status: r.status,
      outlineJson: r.outlineJson,
      language: r.language,
      tone: r.tone,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    } as any
  },
  async findById(planItemId: string): Promise<{ projectId: string; item: PlanItem } | null> {
    if (!hasDatabase()) return null
    const db = getDb()
    const rows = await db.select().from(articlesTable).where(eq(articlesTable.id, planItemId)).limit(1)
    const r: any = rows?.[0]
    if (!r) return null
    return {
      projectId: r.projectId,
      item: {
        id: r.id,
        projectId: r.projectId,
        keywordId: r.keywordId,
        title: r.title,
        plannedDate: r.plannedDate,
        status: r.status,
        outlineJson: r.outlineJson,
        language: r.language,
        tone: r.tone
      } as any
    }
  },
  async removeByProject(projectId: string) {
    if (!hasDatabase()) return
    const db = getDb()
    await db.delete(articlesTable).where(and(eq(articlesTable.projectId, projectId), eq(articlesTable.status as any, 'draft' as any)))
  }
}

function genId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}
