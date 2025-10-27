import type { PlanItem } from './domain/plan-item'
import { keywordsRepo } from '@entities/keyword/repository'

const byProject = new Map<string, PlanItem[]>()

export const planRepo = {
  createPlan(projectId: string, days: number): { jobId: string; created: number } {
    const todayIso = new Date().toISOString().slice(0, 10)
    const millisPerDay = 24 * 60 * 60 * 1000
    const seeds = keywordsRepo.list(projectId, { status: 'recommended', limit: days })
    const items: PlanItem[] = seeds.map((kw, idx) => {
      const plannedDate = new Date(Date.now() + idx * millisPerDay).toISOString().slice(0, 10)
      return {
        id: genId('plan'),
        projectId,
        title: kw.phrase,
        plannedDate: plannedDate || todayIso,
        status: 'planned',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    })
    byProject.set(projectId, items)
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
        return updated
      }
    }
    return null
  }
  ,
  findById(planItemId: string): { projectId: string; item: PlanItem } | null {
    for (const [projectId, items] of byProject.entries()) {
      const found = items.find((i) => i.id === planItemId)
      if (found) return { projectId, item: found }
    }
    return null
  }
}

function genId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}
