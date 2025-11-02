import { planRepo } from '@entities/plan/repository'
import { draftTitleOutline } from '@common/providers/llm'
import * as bundle from '@common/bundle/store'

export async function processPlan(payload: { projectId: string; days: number }) {
  const requestedDays = Number.isFinite(payload.days as any) ? (payload.days as any) : 30
  const outlineDays = Math.max(3, Math.min(90, requestedDays))
  const result = await planRepo.createPlan(String(payload.projectId), outlineDays, { draftDays: 3 })

  const poolSize = Math.max(outlineDays, Math.max(result.outlineIds.length, result.draftIds.length) + 5)
  const planItems = await planRepo.list(String(payload.projectId), poolSize)
  const itemMap = new Map(planItems.map((item) => [item.id, item]))

  for (const id of result.outlineIds) {
    const known = itemMap.get(id) ?? (await planRepo.findById(id))?.item ?? null
    if (!known) continue
    try {
      const seedTitle = known.title || known.outlineJson?.[0]?.heading || 'Draft article'
      const res = await draftTitleOutline(seedTitle)
      await planRepo.updateFields(id, { title: res.title, outlineJson: res.outline, bufferStage: 'outline' })
    } catch {}
  }
  try { if ((await import('@common/config')).config.debug?.writeBundle) { bundle.writeJson(String(payload.projectId), 'planning/plan_v1.json', planItems); bundle.appendLineage(String(payload.projectId), { node: 'plan' }) } } catch {}
  // Kickstart lazy generation for next 3 days (today + 2) after plan refresh
  try {
    const { publishJob, queueEnabled } = await import('@common/infra/queue')
    if (queueEnabled()) {
      for (const planItemId of result.draftIds) {
        await publishJob({ type: 'generate', payload: { projectId: String(payload.projectId), planItemId } })
      }
    }
  } catch {}
}
