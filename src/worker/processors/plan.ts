import { planRepo } from '@entities/plan/repository'
import { draftTitleOutline } from '@common/providers/llm'

export async function processPlan(payload: { projectId: string; days: number }) {
  const days = Number.isFinite(payload.days as any) ? (payload.days as any) : 30
  const { created, jobId } = planRepo.createPlan(String(payload.projectId), Math.max(1, Math.min(365, days)))
  // Best-effort enrich with LLM title/outline for newly created items
  const items = planRepo.list(String(payload.projectId), created)
  for (const item of items) {
    try {
      const res = await draftTitleOutline(item.title)
      planRepo.updateFields(item.id, { title: res.title, outlineJson: res.outline })
    } catch {}
  }
}
