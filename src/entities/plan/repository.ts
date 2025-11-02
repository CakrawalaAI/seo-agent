import type { PlanItem } from './domain/plan-item'
import { clusterKey } from '@common/keyword/cluster'
import { hasDatabase, getDb } from '@common/infra/db'
import { keywords as keywordsTable } from '@entities/keyword/db/schema'
import { keywordCanon } from '@entities/keyword/db/schema.canon'
import { articles as articlesTable } from '@entities/article/db/schema'
import { metricCache } from '@entities/metrics/db/schema'
import { eq, and, asc, gte, lte, isNotNull, inArray } from 'drizzle-orm'

export const planRepo = {
  async createPlan(
    projectId: string,
    days: number,
    opts: { draftDays?: number } = {}
  ): Promise<{
    jobId: string
    created: number
    outlineIds: string[]
    draftIds: string[]
    removedIds: string[]
  }> {
    const jobId = genId('job')
    if (!hasDatabase()) {
      return { jobId, created: 0, outlineIds: [], draftIds: [], removedIds: [] }
    }
    const outlineDays = Math.max(3, Math.min(90, Math.floor(Number.isFinite(days) ? Number(days) : 30)))
    const draftDays = Math.max(1, Math.min(outlineDays, Math.floor(Number(opts.draftDays ?? 3))))
    const db = getDb()
    const now = new Date()
    const baseDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const millisPerDay = 24 * 60 * 60 * 1000
    const targetDates: string[] = []
    for (let idx = 0; idx < outlineDays; idx++) {
      const day = new Date(baseDate.getTime() + idx * millisPerDay)
      targetDates.push(day.toISOString().slice(0, 10))
    }
    const windowStart = targetDates[0]
    const windowEnd = targetDates[targetDates.length - 1]

    const existingRows = await db
      .select({
        id: articlesTable.id,
        projectId: articlesTable.projectId,
        keywordId: articlesTable.keywordId,
        plannedDate: articlesTable.plannedDate,
        status: articlesTable.status,
        bufferStage: articlesTable.bufferStage,
        outlineJson: articlesTable.outlineJson,
        bodyHtml: articlesTable.bodyHtml,
        title: articlesTable.title,
        language: articlesTable.language,
        tone: articlesTable.tone,
        createdAt: articlesTable.createdAt,
        updatedAt: articlesTable.updatedAt,
        keywordScope: keywordsTable.scope,
        keywordStatus: keywordsTable.status,
        keywordPhrase: keywordCanon.phraseNorm,
        metrics: metricCache.metricsJson
      })
      .from(articlesTable)
      .leftJoin(keywordsTable, eq(articlesTable.keywordId, keywordsTable.id))
      .leftJoin(keywordCanon, eq(keywordsTable.canonId, keywordCanon.id))
      .leftJoin(metricCache, eq(metricCache.canonId, keywordCanon.id))
      .where(
        and(
          eq(articlesTable.projectId, projectId),
          isNotNull(articlesTable.plannedDate),
          gte(articlesTable.plannedDate, windowStart),
          lte(articlesTable.plannedDate, windowEnd)
        )
      )
      .orderBy(asc(articlesTable.plannedDate as any), asc(articlesTable.createdAt as any))

    const existingByDate = new Map<string, typeof existingRows>()
    for (const row of existingRows) {
      if (!row.plannedDate) continue
      const bucket = existingByDate.get(row.plannedDate) ?? []
      bucket.push(row)
      existingByDate.set(row.plannedDate, bucket)
    }

    const rawCandidates = await db
      .select({
        id: keywordsTable.id,
        phrase: keywordCanon.phraseNorm,
        scope: keywordsTable.scope,
        status: keywordsTable.status,
        starred: keywordsTable.starred,
        metrics: metricCache.metricsJson
      })
      .from(keywordsTable)
      .innerJoin(keywordCanon, eq(keywordsTable.canonId, keywordCanon.id))
      .leftJoin(metricCache, eq(metricCache.canonId, keywordCanon.id))
      .where(eq(keywordsTable.projectId, projectId))
      .orderBy(asc(keywordCanon.phraseNorm))
      .limit(Math.max(outlineDays * 6, 180))

    const candidates = rawCandidates
      .filter((row) => (row.scope || 'auto') !== 'exclude')
      .map((row) => {
        const metrics = row.metrics || {}
        const volume = typeof (metrics as any)?.searchVolume === 'number' ? Math.max(0, Number((metrics as any).searchVolume)) : 0
        const difficulty = typeof (metrics as any)?.difficulty === 'number' ? Math.min(100, Math.max(0, Number((metrics as any).difficulty))) : 50
        const rankability = typeof (metrics as any)?.rankability === 'number' ? Math.min(100, Math.max(0, Number((metrics as any).rankability))) : null
        const volumeScore = Math.log10(1 + volume)
        const difficultyScore = 1 - difficulty / 100
        const rankBonus = rankability !== null ? rankability / 100 : 0.25
        const score = volumeScore * 0.7 + difficultyScore * 0.25 + rankBonus * 0.05 + (row.starred ? 0.2 : 0)
        return {
          id: row.id,
          phrase: row.phrase,
          score,
          cluster: clusterKey(row.phrase)
        }
      })
      .sort((a, b) => b.score - a.score)

    const usedKeywordIds = new Set<string>()
    const usedClusters = new Set<string>()
    const selectedExistingIds = new Set<string>()
    const outlineIds = new Set<string>()
    const draftIds = new Set<string>()
    const outlineStageFixIds = new Set<string>()
    const draftStageFixIds = new Set<string>()
    const newRows: Array<{
      id: string
      projectId: string
      keywordId: string | null
      title: string
      plannedDate: string
      status: string
      bufferStage: string
    }> = []
    const removeIds = new Set<string>()

    const nextCandidate = () => {
      while (candidates.length) {
        const candidate = candidates.shift()!
        if (usedKeywordIds.has(candidate.id)) continue
        if (candidate.cluster && usedClusters.has(candidate.cluster)) continue
        usedKeywordIds.add(candidate.id)
        if (candidate.cluster) usedClusters.add(candidate.cluster)
        return candidate
      }
      return null
    }

    const rowHasOutline = (row: typeof existingRows[number]) => Array.isArray(row.outlineJson) && row.outlineJson.length > 0
    const rowHasDraft = (row: typeof existingRows[number]) =>
      Boolean(row.bodyHtml && String(row.bodyHtml).trim().length > 0) || row.bufferStage === 'draft' || row.status === 'draft'
    const isIncluded = (row: typeof existingRows[number]) => (row.keywordScope || 'auto') !== 'exclude'

    for (let idx = 0; idx < targetDates.length; idx++) {
      const date = targetDates[idx]
      const isDraftWindow = idx < draftDays
      const options = [...(existingByDate.get(date) ?? [])]
      options.sort((a, b) => {
        const scoreFor = (row: typeof existingRows[number]) => {
          const stage = row.bufferStage || (row.status === 'draft' ? 'draft' : 'seed')
          if (stage === 'draft') return isDraftWindow ? 4 : 2
          if (stage === 'outline') return 3
          return 1
        }
        return scoreFor(b) - scoreFor(a)
      })
      let chosen = options.shift() ?? null
      for (const extra of options) {
        removeIds.add(extra.id)
      }
      if (chosen) {
        const cluster = chosen.keywordPhrase ? clusterKey(chosen.keywordPhrase) : chosen.title ? clusterKey(chosen.title) : null
        if (!isDraftWindow) {
          if (!isIncluded(chosen)) {
            removeIds.add(chosen.id)
            chosen = null
          } else if (cluster && usedClusters.has(cluster)) {
            removeIds.add(chosen.id)
            chosen = null
          } else if (chosen.keywordId && usedKeywordIds.has(chosen.keywordId)) {
            removeIds.add(chosen.id)
            chosen = null
          }
        }
        if (chosen) {
          if (chosen.keywordId) usedKeywordIds.add(chosen.keywordId)
          if (cluster) usedClusters.add(cluster)
        }
      }
      if (!chosen) {
        const candidate = nextCandidate()
        if (!candidate) continue
        const newId = genId('plan')
        newRows.push({
          id: newId,
          projectId,
          keywordId: candidate.id,
          title: candidate.phrase,
          plannedDate: date,
          status: 'planned',
          bufferStage: 'seed'
        })
        outlineIds.add(newId)
        if (isDraftWindow) draftIds.add(newId)
        continue
      }
      selectedExistingIds.add(chosen.id)
      const cluster = chosen.keywordPhrase ? clusterKey(chosen.keywordPhrase) : chosen.title ? clusterKey(chosen.title) : null
      if (cluster) usedClusters.add(cluster)
      if (chosen.keywordId) usedKeywordIds.add(chosen.keywordId)
      if (!rowHasOutline(chosen)) {
        outlineIds.add(chosen.id)
      } else if ((chosen.bufferStage ?? null) === null || chosen.bufferStage === 'seed') {
        outlineStageFixIds.add(chosen.id)
      }
      if (isDraftWindow) {
        if (!rowHasDraft(chosen)) {
          draftIds.add(chosen.id)
        } else if (chosen.bufferStage !== 'draft' || chosen.status !== 'draft') {
          draftStageFixIds.add(chosen.id)
        }
      }
    }

    for (const row of existingRows) {
      if (!selectedExistingIds.has(row.id) && !removeIds.has(row.id)) {
        removeIds.add(row.id)
      }
    }

    const removedList = Array.from(removeIds)

    await db.transaction(async (tx) => {
      if (removedList.length) {
        await tx.delete(articlesTable).where(inArray(articlesTable.id, removedList))
      }
      if (newRows.length) {
        await tx.insert(articlesTable).values(newRows as any).onConflictDoNothing?.()
      }
      if (outlineStageFixIds.size) {
        await tx
          .update(articlesTable)
          .set({ bufferStage: 'outline', status: 'planned', updatedAt: new Date() as any })
          .where(inArray(articlesTable.id, Array.from(outlineStageFixIds)))
      }
      if (draftStageFixIds.size) {
        await tx
          .update(articlesTable)
          .set({ bufferStage: 'draft', status: 'draft', updatedAt: new Date() as any })
          .where(inArray(articlesTable.id, Array.from(draftStageFixIds)))
      }
    })

    const removedSet = new Set(removedList)
    const outlineList = Array.from(outlineIds).filter((id) => !removedSet.has(id))
    const draftList = Array.from(draftIds).filter((id) => !removedSet.has(id))

    return {
      jobId,
      created: newRows.length,
      outlineIds: outlineList,
      draftIds: draftList,
      removedIds: removedList
    }
  },
  async list(projectId: string, limit = 90): Promise<PlanItem[]> {
    if (!hasDatabase()) return []
    const db = getDb()
    const rows = await db
      .select()
      .from(articlesTable)
      .where(
        and(
          eq(articlesTable.projectId, projectId),
          isNotNull(articlesTable.plannedDate),
          inArray(articlesTable.status as any, ['planned', 'draft', 'generating', 'ready'] as any)
        )
      )
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
      bufferStage: (r as any).bufferStage ?? null,
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
      bufferStage: r.bufferStage ?? null,
      language: r.language,
      tone: r.tone,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    } as any
  },
  async updateFields(planItemId: string, patch: Partial<Pick<PlanItem, 'title' | 'outlineJson' | 'status' | 'bufferStage'>>): Promise<PlanItem | null> {
    if (!hasDatabase()) return null
    const db = getDb()
    const set: any = { updatedAt: new Date() as any }
    if (typeof patch.title === 'string') set.title = patch.title
    if (patch.outlineJson) {
      set.outlineJson = patch.outlineJson as any
      if (!patch.bufferStage) {
        set.bufferStage = 'outline'
      }
    }
    if (typeof patch.status === 'string') {
      set.status = patch.status
      if (patch.status === 'draft') {
        set.bufferStage = 'draft'
      }
    }
    if (typeof patch.bufferStage === 'string') {
      set.bufferStage = patch.bufferStage
    }
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
      bufferStage: r.bufferStage ?? null,
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
        bufferStage: r.bufferStage ?? null,
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
