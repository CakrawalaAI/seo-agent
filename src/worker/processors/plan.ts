import { planRepo } from '@entities/plan/repository'
import { draftTitleOutline } from '@common/providers/llm'
import * as bundle from '@common/bundle/store'

export async function processPlan(payload: { projectId: string; days: number }) {
  const days = Number.isFinite(payload.days as any) ? (payload.days as any) : 30
  const { created, jobId } = await planRepo.createPlan(String(payload.projectId), Math.max(1, Math.min(365, days)))
  // Best-effort enrich with LLM title/outline for newly created items
  const items = await planRepo.list(String(payload.projectId), created)
  for (const item of items) {
    try {
      const res = await draftTitleOutline(item.title)
      await planRepo.updateFields(item.id, { title: res.title, outlineJson: res.outline })
    } catch {}
  }
  try { if ((await import('@common/config')).config.debug?.writeBundle) { bundle.writeJson(String(payload.projectId), 'planning/plan_v1.json', items); bundle.appendLineage(String(payload.projectId), { node: 'plan' }) } } catch {}
  // Kickstart lazy generation for next 3 days (today + 2) after plan is created
  try {
    const today = new Date()
    const ymd = (d: Date) => d.toISOString().slice(0, 10)
    const window = new Set([0,1,2].map(delta => ymd(new Date(today.getTime() + delta*24*60*60*1000))))
    const next3 = items.filter((i) => window.has(i.plannedDate))
    const { publishJob, queueEnabled } = await import('@common/infra/queue')
    if (queueEnabled()) {
      for (const it of next3) {
        await publishJob({ type: 'generate', payload: { projectId: String(payload.projectId), planItemId: it.id } })
      }
    }
  } catch {}
}
