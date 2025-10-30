import type { PlanItem } from './domain/plan-item'
import { clusterKey } from '@common/keyword/cluster'
import { keywordsRepo } from '@entities/keyword/repository'
import { hasDatabase, getDb } from '@common/infra/db'
import { planItems as planItemsTable } from './db/schema'
import { eq } from 'drizzle-orm'

const byProject = new Map<string, PlanItem[]>()

export const planRepo = {
  createPlan(projectId: string, days: number): { jobId: string; created: number } {
    const todayIso = new Date().toISOString().slice(0, 10)
    const millisPerDay = 24 * 60 * 60 * 1000
    // pick top N by opportunity (fallback: first N)
    const all = keywordsRepo.list(projectId, { status: 'all', limit: 1000 })
    const sorted = [...all].sort((a, b) => (b.opportunity ?? 0) - (a.opportunity ?? 0))
    const unique: typeof sorted = []
    const seenCluster = new Set<string>()
    for (const k of sorted) {
      const ck = clusterKey(k.phrase)
      if (seenCluster.has(ck)) continue
      seenCluster.add(ck)
      unique.push(k)
      if (unique.length >= Math.max(1, days)) break
    }
    const items: PlanItem[] = unique.map((kw, idx) => {
      const plannedDate = new Date(Date.now() + idx * millisPerDay).toISOString().slice(0, 10)
      return {
        id: genId('plan'),
        projectId,
        keywordId: (kw as any).id ?? undefined,
        title: kw.phrase,
        plannedDate: plannedDate || todayIso,
        status: 'planned',
        outlineJson: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    })
    byProject.set(projectId, items)
    if (hasDatabase()) void (async () => { try { const db = getDb(); await db.insert(planItemsTable).values(items as any).onConflictDoNothing?.(); } catch {} })()
    return { jobId: genId('job'), created: items.length }
  },
  list(projectId: string, limit = 90): PlanItem[] {
    const all = byProject.get(projectId) ?? []
    const sorted = [...all].sort((a, b) => a.plannedDate.localeCompare(b.plannedDate))
    return sorted.slice(0, limit)
  },
  updateDate(planItemId: string, plannedDate: string): PlanItem | null {
    for (const [projectId, items] of byProject.entries()) {
      const idx = items.findIndex((i) => i.id === planItemId)
      if (idx >= 0) {
        const updated: PlanItem = { ...items[idx]!, plannedDate, updatedAt: new Date().toISOString() }
        items[idx] = updated
        byProject.set(projectId, items)
        if (hasDatabase()) void (async () => { try { const db = getDb(); await db.update(planItemsTable).set({ plannedDate, updatedAt: new Date() as any }).where(eq(planItemsTable.id, planItemId)); } catch {} })()
        return updated
      }
    }
    return null
  },
  updateFields(planItemId: string, patch: Partial<Pick<PlanItem, 'title' | 'outlineJson' | 'status'>>): PlanItem | null {
    for (const [projectId, items] of byProject.entries()) {
      const idx = items.findIndex((i) => i.id === planItemId)
      if (idx >= 0) {
        const updated: PlanItem = { ...items[idx]!, ...patch, updatedAt: new Date().toISOString() }
        items[idx] = updated
        byProject.set(projectId, items)
        if (hasDatabase()) void (async () => { try { const db = getDb(); const set: any = { updatedAt: new Date() as any }; if (typeof patch.title === 'string') set.title = patch.title; if (patch.outlineJson) set.outlineJson = patch.outlineJson as any; if (typeof patch.status === 'string') set.status = patch.status; await db.update(planItemsTable).set(set).where(eq(planItemsTable.id, planItemId)); } catch {} })()
        return updated
      }
    }
    return null
  },
  findById(planItemId: string): { projectId: string; item: PlanItem } | null {
    for (const [projectId, items] of byProject.entries()) {
      const found = items.find((i) => i.id === planItemId)
      if (found) return { projectId, item: found }
    }
    return null
  },
  removeByProject(projectId: string) {
    byProject.delete(projectId)
  }
}

function genId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}
