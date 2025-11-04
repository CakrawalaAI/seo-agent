import { planRepo } from '@entities/article/planner'
import { websitesRepo } from '@entities/website/repository'
import { draftTitleOutline } from '@common/providers/llm'
import { log } from '@src/common/logger'

export async function processPlan(payload: { projectId?: string; websiteId?: string; days: number }) {
  const websiteId = String(payload.websiteId || payload.projectId)
  const project = await websitesRepo.get(websiteId)
  if (!project) { log.info('[plan] website not found', { websiteId }); return }
  const requestedDays = Number.isFinite(payload.days as any) ? (payload.days as any) : 30
  const outlineDays = Math.max(3, Math.min(90, requestedDays))
  const result = await planRepo.createPlan(String(websiteId), outlineDays, { draftDays: 3 })

  const poolSize = Math.max(outlineDays, Math.max(result.outlineIds.length, result.draftIds.length) + 5)
  const planItems = await planRepo.list(String(websiteId), poolSize)
  const itemMap = new Map(planItems.map((item) => [item.id, item]))

  for (const id of result.outlineIds) {
    const known = itemMap.get(id) ?? (await planRepo.findById(id))?.item ?? null
    if (!known) continue
    try {
      const seedTitle = known.title || known.outlineJson?.[0]?.heading || 'Draft article'
      const res = await draftTitleOutline(seedTitle)
      await planRepo.updateFields(id, { title: res.title, outlineJson: res.outline, status: known.status === 'scheduled' ? 'scheduled' : 'queued' })
    } catch {}
  }
  try { await websitesRepo.patch(websiteId, { status: 'articles_scheduled' }) } catch {}
}
