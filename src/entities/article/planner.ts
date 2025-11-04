import { clusterKey } from '@common/keyword/cluster'
import { hasDatabase, getDb } from '@common/infra/db'
import { websiteKeywords } from '@entities/keyword/db/schema.website_keywords'
import { articles as articlesTable } from '@entities/article/db/schema'
import { eq, and, asc, gte, lte, isNotNull, inArray } from 'drizzle-orm'

export type PlanItem = {
  id: string
  websiteId: string
  keywordId: string | null
  title: string
  scheduledDate: string
  status: string
  outlineJson?: Array<{ heading: string; subpoints?: string[] }> | null
  language?: string | null
  tone?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export const planRepo = {
  async createPlan(
    websiteId: string,
    days: number,
    opts: { draftDays?: number } = {}
  ): Promise<{ jobId: string; created: number; outlineIds: string[]; draftIds: string[]; removedIds: string[] }> {
    const jobId = genId('job')
    if (!hasDatabase()) return { jobId, created: 0, outlineIds: [], draftIds: [], removedIds: [] }
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
        projectId: (articlesTable as any).websiteId,
        keywordId: articlesTable.keywordId,
        scheduledDate: (articlesTable as any).scheduledDate,
        status: articlesTable.status,
        outlineJson: articlesTable.outlineJson,
        bodyHtml: articlesTable.bodyHtml,
        title: articlesTable.title,
        language: articlesTable.language,
        tone: articlesTable.tone,
        createdAt: articlesTable.createdAt,
        updatedAt: articlesTable.updatedAt,
        include: websiteKeywords.include,
        keywordStatus: (articlesTable as any).status,
        keywordPhrase: websiteKeywords.phrase,
        metricsCols: {
          searchVolume: websiteKeywords.searchVolume,
          difficulty: websiteKeywords.difficulty,
          cpc: websiteKeywords.cpc,
          competition: websiteKeywords.competition,
          metricsAsOf: websiteKeywords.metricsAsOf
        }
      })
      .from(articlesTable)
      .leftJoin(websiteKeywords, eq(articlesTable.keywordId, websiteKeywords.id))
      .where(and(eq((articlesTable as any).websiteId, websiteId), isNotNull((articlesTable as any).scheduledDate), gte((articlesTable as any).scheduledDate as any, windowStart), lte((articlesTable as any).scheduledDate as any, windowEnd)))
      .orderBy(asc((articlesTable as any).scheduledDate as any), asc(articlesTable.createdAt as any))

    const existingByDate = new Map<string, typeof existingRows>()
    for (const row of existingRows) {
      if (!row.scheduledDate) continue
      const bucket = existingByDate.get(row.scheduledDate) ?? []
      bucket.push(row)
      existingByDate.set(row.scheduledDate, bucket)
    }

    const rawCandidates = await db
      .select({
        id: websiteKeywords.id,
        phrase: websiteKeywords.phrase,
        include: websiteKeywords.include,
        status: (websiteKeywords as any).status,
        starred: websiteKeywords.starred,
        metricsCols: {
          searchVolume: websiteKeywords.searchVolume,
          difficulty: websiteKeywords.difficulty,
          cpc: websiteKeywords.cpc,
          competition: websiteKeywords.competition,
          metricsAsOf: websiteKeywords.metricsAsOf
        }
      })
      .from(websiteKeywords)
      .where(eq(websiteKeywords.websiteId, websiteId))
      .orderBy(asc(websiteKeywords.phrase))
      .limit(Math.max(outlineDays * 6, 180))

    const candidates = rawCandidates
      .filter((row) => Boolean((row as any).include))
      .map((row) => {
        const m = (row as any).metricsCols || {}
        const volume = typeof m.searchVolume === 'number' ? Math.max(0, Number(m.searchVolume)) : 0
        const difficulty = typeof m.difficulty === 'number' ? Math.min(100, Math.max(0, Number(m.difficulty))) : 50
        const rankability = null
        const volumeScore = Math.log10(1 + volume)
        const difficultyScore = 1 - difficulty / 100
        const rankBonus = rankability !== null ? rankability / 100 : 0.25
        const score = volumeScore * 0.7 + difficultyScore * 0.25 + rankBonus * 0.05 + (row.starred ? 0.2 : 0)
        return { id: row.id, phrase: row.phrase, score, cluster: clusterKey(row.phrase) }
      })
      .sort((a, b) => b.score - a.score)

    const usedKeywordIds = new Set<string>()
    const usedClusters = new Set<string>()
    const selectedExistingIds = new Set<string>()
    const outlineIds = new Set<string>()
    const draftIds = new Set<string>()
    const queuedFixIds = new Set<string>()
    const scheduledFixIds = new Set<string>()
    const newRows: Array<{ id: string; websiteId: string; keywordId: string | null; title: string; scheduledDate: string; status: string }> = []
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
    const rowHasBody = (row: typeof existingRows[number]) => Boolean(row.bodyHtml && String(row.bodyHtml).trim().length > 0)
    const canonicalStatus = (row: typeof existingRows[number]) => {
      const raw = String(row.status || '').toLowerCase()
      if (raw === 'published') return 'published'
      if (raw === 'scheduled' || raw === 'draft' || raw === 'ready' || raw === 'generating') return 'scheduled'
      return 'queued'
    }
    const isIncluded = (row: typeof existingRows[number]) => Boolean((row as any).include ?? true)

    for (let idx = 0; idx < targetDates.length; idx++) {
      const date = targetDates[idx]
      const isDraftWindow = idx < draftDays
      const options = [...(existingByDate.get(date) ?? [])]
      options.sort((a, b) => {
        const scoreFor = (row: typeof existingRows[number]) => {
          const status = canonicalStatus(row)
          if (status === 'scheduled') return isDraftWindow ? 4 : 2
          if (rowHasOutline(row)) return 3
          return 1
        }
        return scoreFor(b) - scoreFor(a)
      })
      let chosen = options.shift() ?? null
      for (const extra of options) removeIds.add(extra.id)
      if (chosen) {
        const cluster = chosen.keywordPhrase ? clusterKey(chosen.keywordPhrase) : chosen.title ? clusterKey(chosen.title) : null
        if (!isDraftWindow) {
          if (!isIncluded(chosen)) { removeIds.add(chosen.id); chosen = null }
          else if (cluster && usedClusters.has(cluster)) { removeIds.add(chosen.id); chosen = null }
          else if (chosen.keywordId && usedKeywordIds.has(chosen.keywordId)) { removeIds.add(chosen.id); chosen = null }
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
        newRows.push({ id: newId, websiteId, keywordId: candidate.id, title: candidate.phrase, scheduledDate: date, status: 'queued' })
        outlineIds.add(newId)
        if (isDraftWindow) draftIds.add(newId)
        continue
      }
      selectedExistingIds.add(chosen.id)
      const cluster = chosen.keywordPhrase ? clusterKey(chosen.keywordPhrase) : chosen.title ? clusterKey(chosen.title) : null
      if (cluster) usedClusters.add(cluster)
      if (chosen.keywordId) usedKeywordIds.add(chosen.keywordId)
      if (!rowHasOutline(chosen)) outlineIds.add(chosen.id)
      else if (canonicalStatus(chosen) === 'queued' && !rowHasBody(chosen)) outlineIds.add(chosen.id)
      if (isDraftWindow) {
        if (!rowHasBody(chosen)) draftIds.add(chosen.id)
        else if (canonicalStatus(chosen) !== 'scheduled') scheduledFixIds.add(chosen.id)
      } else if (canonicalStatus(chosen) !== 'queued') {
        queuedFixIds.add(chosen.id)
      }
    }

    for (const row of existingRows) {
      if (!selectedExistingIds.has(row.id) && !removeIds.has(row.id)) removeIds.add(row.id)
    }

    const removedList = Array.from(removeIds)

    await db.transaction(async (tx) => {
      if (removedList.length) await tx.delete(articlesTable).where(inArray(articlesTable.id, removedList))
      if (newRows.length) {
        const rows = newRows.map((r) => ({ id: r.id, websiteId: r.websiteId, keywordId: r.keywordId, title: r.title, scheduledDate: (r as any).scheduledDate, status: r.status as any }))
        await tx.insert(articlesTable).values(rows as any).onConflictDoNothing?.()
      }
      const nowTs = new Date() as any
      if (queuedFixIds.size) await tx.update(articlesTable).set({ status: 'queued', updatedAt: nowTs }).where(inArray(articlesTable.id, Array.from(queuedFixIds)))
      if (scheduledFixIds.size) await tx.update(articlesTable).set({ status: 'scheduled', updatedAt: nowTs }).where(inArray(articlesTable.id, Array.from(scheduledFixIds)))
    })

    const removedSet = new Set(removedList)
    const outlineList = Array.from(outlineIds).filter((id) => !removedSet.has(id))
    const draftList = Array.from(draftIds).filter((id) => !removedSet.has(id))

    return { jobId, created: newRows.length, outlineIds: outlineList, draftIds: draftList, removedIds: removedList }
  },

  async list(websiteId: string, limit = 90): Promise<PlanItem[]> {
    if (!hasDatabase()) return []
    const db = getDb()
    const rows = await db
      .select()
      .from(articlesTable)
      .where(and(eq((articlesTable as any).websiteId, websiteId), isNotNull((articlesTable as any).scheduledDate), inArray(articlesTable.status as any, ['queued', 'scheduled', 'published'] as any)))
      .orderBy(asc((articlesTable as any).scheduledDate as any))
      .limit(limit)
    return (rows as any[]).map((r) => ({ id: r.id, websiteId: (r as any).websiteId, keywordId: r.keywordId ?? null, title: r.title ?? '', scheduledDate: (r as any).scheduledDate ?? '', status: (r.status as any) ?? 'queued', outlineJson: (r as any).outlineJson ?? null, language: r.language ?? null, tone: r.tone ?? null, createdAt: r.createdAt, updatedAt: r.updatedAt })) as any
  },

  async updateDate(planItemId: string, scheduledDate: string): Promise<PlanItem | null> {
    if (!hasDatabase()) return null
    const db = getDb()
    await db.update(articlesTable).set({ scheduledDate, updatedAt: new Date() as any }).where(eq(articlesTable.id, planItemId))
    const rows = await db.select().from(articlesTable).where(eq(articlesTable.id, planItemId)).limit(1)
    const r: any = rows?.[0]
    if (!r) return null
    return { id: r.id, websiteId: r.websiteId, keywordId: r.keywordId, title: r.title, scheduledDate: r.scheduledDate, status: r.status, outlineJson: r.outlineJson, language: r.language, tone: r.tone, createdAt: r.createdAt, updatedAt: r.updatedAt } as any
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
    return { id: r.id, websiteId: r.websiteId, keywordId: r.keywordId, title: r.title, scheduledDate: r.scheduledDate, status: r.status, outlineJson: r.outlineJson, language: r.language, tone: r.tone, createdAt: r.createdAt, updatedAt: r.updatedAt } as any
  },

  async findById(planItemId: string): Promise<{ websiteId: string; item: PlanItem } | null> {
    if (!hasDatabase()) return null
    const db = getDb()
    const rows = await db.select().from(articlesTable).where(eq(articlesTable.id, planItemId)).limit(1)
    const r: any = rows?.[0]
    if (!r) return null
    return { websiteId: r.websiteId, item: { id: r.id, websiteId: r.websiteId, keywordId: r.keywordId, title: r.title, scheduledDate: r.scheduledDate, status: r.status, outlineJson: r.outlineJson, language: r.language, tone: r.tone } as any }
  },

  async removeByProject(websiteId: string) {
    if (!hasDatabase()) return
    const db = getDb()
    await db.delete(articlesTable).where(and(eq((articlesTable as any).websiteId, websiteId), inArray(articlesTable.status as any, ['queued', 'scheduled'] as any)))
  }
}

function genId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}
