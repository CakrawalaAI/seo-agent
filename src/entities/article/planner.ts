import { clusterKey } from '@common/keyword/cluster'
import { hasDatabase, getDb } from '@common/infra/db'
import { keywords } from '@entities/keyword/db/schema.keywords'
import { articles as articlesTable } from '@entities/article/db/schema'
import { eq, and, asc, gte, lte, isNotNull, inArray, sql } from 'drizzle-orm'
import { log } from '@src/common/logger'

export type PlanItem = {
  id: string
  websiteId: string
  keywordId: string | null
  title: string
  targetKeyword?: string | null
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

    let existingRows: Array<{
      id: string
      projectId: string
      keywordId: string | null
      scheduledDate: string | null
      status: string | null
      outlineJson?: unknown
      bodyHtml?: unknown
      title?: string | null
      targetKeyword?: string | null
      language?: string | null
      tone?: string | null
      createdAt?: unknown
      updatedAt?: unknown
      active?: unknown
      keywordPhrase?: string | null
      metricsCols?: Record<string, unknown> | null
    }> = []
    try {
      existingRows = await db
        .select({
          id: articlesTable.id,
          projectId: (articlesTable as any).websiteId,
          keywordId: articlesTable.keywordId,
          scheduledDate: (articlesTable as any).scheduledDate,
          status: articlesTable.status,
          outlineJson: articlesTable.outlineJson,
          bodyHtml: articlesTable.bodyHtml,
          title: articlesTable.title,
          targetKeyword: articlesTable.targetKeyword,
          language: articlesTable.language,
          tone: articlesTable.tone,
          createdAt: articlesTable.createdAt,
          updatedAt: articlesTable.updatedAt,
          active: (keywords as any).active,
          keywordPhrase: keywords.phrase,
          metricsCols: {
            searchVolume: keywords.searchVolume,
            difficulty: keywords.difficulty,
            cpc: keywords.cpc,
            competition: keywords.competition,
            metricsAsOf: keywords.metricsAsOf
          }
        })
        .from(articlesTable)
        .leftJoin(keywords, eq(articlesTable.keywordId, keywords.id))
        .where(and(eq((articlesTable as any).websiteId, websiteId), isNotNull((articlesTable as any).scheduledDate), gte((articlesTable as any).scheduledDate as any, windowStart), lte((articlesTable as any).scheduledDate as any, windowEnd)))
        .orderBy(asc((articlesTable as any).scheduledDate as any), asc(articlesTable.createdAt as any))
    } catch (error) {
      log.debug('[planRepo.createPlan] existing rows query failed', { websiteId, error: (error as Error)?.message || String(error) })
      throw error
    }

    const existingByDate = new Map<string, typeof existingRows>()
    for (const row of existingRows) {
      if (!row.scheduledDate) continue
      const bucket = existingByDate.get(row.scheduledDate) ?? []
      bucket.push(row)
      existingByDate.set(row.scheduledDate, bucket)
    }

    if (!keywords.id || !keywords.phrase || !(keywords as any).active) {
      log.debug('[planRepo.createPlan] keyword schema columns detected', {
        websiteId,
        hasId: Boolean(keywords.id),
        hasPhrase: Boolean(keywords.phrase),
        hasActive: Boolean((keywords as any).active),
        hasDifficulty: Boolean((keywords as any).difficulty),
        hasMetricsAsOf: Boolean((keywords as any).metricsAsOf)
      })
    }

    let rawCandidates: Array<{
      id: string
      phrase: string | null
      active: unknown
      starred: unknown
      metricsCols?: Record<string, unknown> | null
    }> = []
    try {
      rawCandidates = await db
        .select({
          id: keywords.id,
          phrase: keywords.phrase,
          active: (keywords as any).active,
          starred: keywords.starred,
          metricsCols: {
            searchVolume: keywords.searchVolume,
            difficulty: keywords.difficulty,
            cpc: keywords.cpc,
            competition: keywords.competition,
            metricsAsOf: keywords.metricsAsOf
          }
        })
        .from(keywords)
        .where(eq(keywords.websiteId, websiteId))
        .orderBy(asc(keywords.phrase))
        .limit(Math.max(outlineDays * 6, 180))
    } catch (error) {
      log.debug('[planRepo.createPlan] keyword query failed', { websiteId, error: (error as Error)?.message || String(error) })
      throw error
    }

    log.debug('[planRepo.createPlan] fetched keyword candidates', { websiteId, total: rawCandidates.length })

    const safeCluster = (value: unknown) => {
      if (typeof value !== 'string') return null
      const trimmed = value.trim()
      if (!trimmed) return null
      try {
        return clusterKey(trimmed)
      } catch (error) {
        log.debug('[planRepo.createPlan] cluster key failed', {
          websiteId,
          error: (error as Error)?.message || String(error)
        })
        return null
      }
    }

    const rankedCandidates = rawCandidates
      .map((row) => {
        const hasPhrase = typeof row.phrase === 'string' && row.phrase.trim().length > 0
        if (!hasPhrase) {
          log.debug('[planRepo.createPlan] skip candidate missing phrase', { websiteId, keywordId: row.id })
          return null
        }
        const m = (row as any).metricsCols || {}
        const volume = typeof m.searchVolume === 'number' ? Math.max(0, Number(m.searchVolume)) : 0
        const difficulty = typeof m.difficulty === 'number' ? Math.min(100, Math.max(0, Number(m.difficulty))) : 50
        const rankability = null
        const volumeScore = Math.log10(1 + volume)
        const difficultyScore = 1 - difficulty / 100
        const rankBonus = rankability !== null ? rankability / 100 : 0.25
        const score = volumeScore * 0.7 + difficultyScore * 0.25 + rankBonus * 0.05 + (row.starred ? 0.2 : 0)
        return { id: row.id, phrase: row.phrase!.trim(), active: Boolean((row as any).active), score, cluster: safeCluster(row.phrase) }
      })
      .filter((row): row is { id: string; phrase: string; active: boolean; score: number; cluster: string | null } => Boolean(row))
      .sort((a, b) => b.score - a.score)

    const primary = rankedCandidates.filter((row) => row.active)
    const secondary = rankedCandidates.filter((row) => !row.active)
    let candidates = [...primary]
    if (candidates.length < outlineDays) {
      const deficit = outlineDays - candidates.length
      const extras = secondary.slice(0, Math.max(deficit * 2, deficit))
      candidates = candidates.concat(extras)
      log.debug('[planRepo.createPlan] supplementing candidate pool', {
        websiteId,
        included: primary.length,
        supplemented: extras.length,
        target: outlineDays
      })
    }

    log.debug('[planRepo.createPlan] prepared candidates', { websiteId, usable: candidates.length, included: primary.length })

    const usedKeywordIds = new Set<string>()
    const usedClusters = new Set<string>()
    const selectedExistingIds = new Set<string>()
    const outlineIds = new Set<string>()
    const draftIds = new Set<string>()
    const queuedFixIds = new Set<string>()
    const scheduledFixIds = new Set<string>()
    const targetKeywordFixes = new Map<string, string>()
    const newRows: Array<{ id: string; websiteId: string; keywordId: string | null; title: string; targetKeyword: string | null; scheduledDate: string; status: string }> = []
    const removeIds = new Set<string>()

    const queue = [...candidates]
    const deferred: typeof candidates = []
    let allowRepeatClusters = false

    const nextCandidate = () => {
      while (queue.length) {
        const candidate = queue.shift()!
        if (usedKeywordIds.has(candidate.id)) continue
        const clusterUsed = candidate.cluster && usedClusters.has(candidate.cluster)
        if (clusterUsed && !allowRepeatClusters) {
          deferred.push(candidate)
          continue
        }
        usedKeywordIds.add(candidate.id)
        if (candidate.cluster) usedClusters.add(candidate.cluster)
        return candidate
      }
      if (!allowRepeatClusters && deferred.length) {
        allowRepeatClusters = true
        queue.push(...deferred)
        deferred.length = 0
        return nextCandidate()
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
    const isActive = (row: typeof existingRows[number]) => Boolean((row as any).active ?? true)

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
        const cluster = safeCluster(chosen.targetKeyword) ?? safeCluster(chosen.keywordPhrase) ?? safeCluster(chosen.title)
        if (!isDraftWindow) {
          if (!isActive(chosen)) { removeIds.add(chosen.id); chosen = null }
          else if (cluster && usedClusters.has(cluster)) { removeIds.add(chosen.id); chosen = null }
          else if (chosen.keywordId && usedKeywordIds.has(chosen.keywordId)) { removeIds.add(chosen.id); chosen = null }
        }
        if (chosen) {
          if (chosen.keywordId) usedKeywordIds.add(chosen.keywordId)
          if (cluster) usedClusters.add(cluster)
          const keywordString = (typeof chosen.targetKeyword === 'string' && chosen.targetKeyword.trim().length > 0)
            ? chosen.targetKeyword
            : (typeof chosen.keywordPhrase === 'string' && chosen.keywordPhrase.trim().length > 0)
            ? chosen.keywordPhrase
            : (typeof chosen.title === 'string' && chosen.title.trim().length > 0)
            ? chosen.title
            : null
          if (!chosen.targetKeyword && keywordString) targetKeywordFixes.set(chosen.id, keywordString)
        }
      }
      if (!chosen) {
        const candidate = nextCandidate()
        if (!candidate) continue
        const newId = genId('plan')
        newRows.push({ id: newId, websiteId, keywordId: candidate.id, title: candidate.phrase, targetKeyword: candidate.phrase, scheduledDate: date, status: 'queued' })
        outlineIds.add(newId)
        if (isDraftWindow) draftIds.add(newId)
        continue
      }
      selectedExistingIds.add(chosen.id)
      const cluster = safeCluster(chosen.targetKeyword) ?? safeCluster(chosen.keywordPhrase) ?? safeCluster(chosen.title)
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
        const rows = newRows.map((r) => ({ id: r.id, websiteId: r.websiteId, keywordId: r.keywordId, title: r.title, targetKeyword: r.targetKeyword, scheduledDate: (r as any).scheduledDate, status: r.status as any }))
        await tx.insert(articlesTable).values(rows as any).onConflictDoNothing?.()
      }
      const nowTs = new Date() as any
      if (queuedFixIds.size) await tx.update(articlesTable).set({ status: 'queued', updatedAt: nowTs }).where(inArray(articlesTable.id, Array.from(queuedFixIds)))
      if (scheduledFixIds.size) await tx.update(articlesTable).set({ status: 'scheduled', updatedAt: nowTs }).where(inArray(articlesTable.id, Array.from(scheduledFixIds)))
      if (targetKeywordFixes.size) {
        for (const [articleId, keywordValue] of targetKeywordFixes.entries()) {
          await tx.update(articlesTable).set({ targetKeyword: keywordValue, updatedAt: nowTs }).where(eq(articlesTable.id, articleId))
        }
      }
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
    return (rows as any[]).map((r) => ({ id: r.id, websiteId: (r as any).websiteId, keywordId: r.keywordId ?? null, title: r.title ?? '', targetKeyword: r.targetKeyword ?? null, scheduledDate: (r as any).scheduledDate ?? '', status: (r.status as any) ?? 'queued', outlineJson: (r as any).outlineJson ?? null, language: r.language ?? null, tone: r.tone ?? null, createdAt: r.createdAt, updatedAt: r.updatedAt })) as any
  },

  async counts(websiteId: string): Promise<{ total: number; scheduled: number; queued: number }> {
    if (!hasDatabase()) return { total: 0, scheduled: 0, queued: 0 }
    const db = getDb()
    const [row] = await db
      .select({
        total: sql<number>`count(*)`,
        scheduled: sql<number>`sum(case when ${articlesTable}.status = 'scheduled' then 1 else 0 end)`,
        queued: sql<number>`sum(case when ${articlesTable}.status = 'queued' then 1 else 0 end)`
      })
      .from(articlesTable)
      .where(
        and(
          eq((articlesTable as any).websiteId, websiteId),
          isNotNull((articlesTable as any).scheduledDate),
          inArray(articlesTable.status as any, ['queued', 'scheduled', 'published'] as any)
        )
      )
    return {
      total: Number(row?.total ?? 0),
      scheduled: Number(row?.scheduled ?? 0),
      queued: Number(row?.queued ?? 0)
    }
  },

  async updateDate(planItemId: string, scheduledDate: string): Promise<PlanItem | null> {
    if (!hasDatabase()) return null
    const db = getDb()
    await db.update(articlesTable).set({ scheduledDate, updatedAt: new Date() as any }).where(eq(articlesTable.id, planItemId))
    const rows = await db.select().from(articlesTable).where(eq(articlesTable.id, planItemId)).limit(1)
    const r: any = rows?.[0]
    if (!r) return null
    return { id: r.id, websiteId: r.websiteId, keywordId: r.keywordId, title: r.title, targetKeyword: r.targetKeyword, scheduledDate: r.scheduledDate, status: r.status, outlineJson: r.outlineJson, language: r.language, tone: r.tone, createdAt: r.createdAt, updatedAt: r.updatedAt } as any
  },

  async updateFields(planItemId: string, patch: Partial<Pick<PlanItem, 'title' | 'outlineJson' | 'status' | 'targetKeyword'>>): Promise<PlanItem | null> {
    if (!hasDatabase()) return null
    const db = getDb()
    const set: any = { updatedAt: new Date() as any }
    if (typeof patch.title === 'string') set.title = patch.title
    if (typeof patch.targetKeyword === 'string') set.targetKeyword = patch.targetKeyword
    if (patch.outlineJson) set.outlineJson = patch.outlineJson as any
    if (typeof patch.status === 'string') set.status = patch.status
    await db.update(articlesTable).set(set).where(eq(articlesTable.id, planItemId))
    const rows = await db.select().from(articlesTable).where(eq(articlesTable.id, planItemId)).limit(1)
    const r: any = rows?.[0]
    if (!r) return null
    return { id: r.id, websiteId: r.websiteId, keywordId: r.keywordId, title: r.title, targetKeyword: r.targetKeyword, scheduledDate: r.scheduledDate, status: r.status, outlineJson: r.outlineJson, language: r.language, tone: r.tone, createdAt: r.createdAt, updatedAt: r.updatedAt } as any
  },

  async findById(planItemId: string): Promise<{ websiteId: string; item: PlanItem } | null> {
    if (!hasDatabase()) return null
    const db = getDb()
    const rows = await db.select().from(articlesTable).where(eq(articlesTable.id, planItemId)).limit(1)
    const r: any = rows?.[0]
    if (!r) return null
    return { websiteId: r.websiteId, item: { id: r.id, websiteId: r.websiteId, keywordId: r.keywordId, title: r.title, targetKeyword: r.targetKeyword, scheduledDate: r.scheduledDate, status: r.status, outlineJson: r.outlineJson, language: r.language, tone: r.tone } as any }
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
