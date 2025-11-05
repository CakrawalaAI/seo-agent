import { planRepo } from '@entities/article/planner'
import { websitesRepo } from '@entities/website/repository'
import { publishJob, queueEnabled } from '@common/infra/queue'
import { getLlmProvider } from '@common/providers/registry'
import { log } from '@src/common/logger'
// Realtime broadcast removed; dashboard polls snapshot

export async function processPlan(payload: { projectId?: string; websiteId?: string; days: number }) {
  const websiteId = String(payload.websiteId || payload.projectId)
  const project = await websitesRepo.get(websiteId)
  if (!project) { log.info('[plan] website not found', { websiteId }); return }
  const requestedDays = Number.isFinite(payload.days as any) ? (payload.days as any) : 30
  const outlineDays = Math.max(3, Math.min(90, requestedDays))
  log.debug('[plan] create window', { websiteId, requestedDays, outlineDays })
  const llm = getLlmProvider()
  const locale = project?.defaultLocale || 'en-US'
  let result: Awaited<ReturnType<typeof planRepo.createPlan>>
  try {
    result = await planRepo.createPlan(String(websiteId), outlineDays, { draftDays: 3 })
  } catch (error) {
    log.debug('[plan] createPlan failed', { websiteId, error: (error as Error)?.message || String(error) })
    throw error
  }
  log.debug('[plan] plan results', { websiteId, outlineIds: result.outlineIds.length, draftIds: result.draftIds.length })

  const poolSize = Math.max(outlineDays, Math.max(result.outlineIds.length, result.draftIds.length) + 5)
  const planItems = await planRepo.list(String(websiteId), poolSize)
  log.debug('[plan] fetched plan items', { websiteId, poolSize, items: planItems.length })
  const itemMap = new Map(planItems.map((item) => [item.id, item]))
  if (result.outlineIds.length) {
    log.debug('[plan] drafting outlines', { websiteId, count: result.outlineIds.length })
    // Parallelize outline drafting. Concurrency == number of articles to generate.
    const targetConcurrency = Math.max(1, result.draftIds.length || 1)
    const queue = result.outlineIds.slice()
    const errors: Array<{ id: string; message: string }> = []
    const worker = async () => {
      for (;;) {
        const id = queue.shift()
        if (!id) break
        const known = itemMap.get(id) ?? (await planRepo.findById(id))?.item ?? null
        if (!known) continue
        try {
          const seedTitle = known.title || known.outlineJson?.[0]?.heading || 'Draft article'
          const res = await llm.draftOutline(seedTitle, locale)
          await planRepo.updateFields(id, { title: res.title, outlineJson: res.outline, status: known.status === 'scheduled' ? 'scheduled' : 'queued' })
        } catch (error) {
          const message = (error as Error)?.message || String(error)
          log.error('[plan] outline generation failed', { websiteId, planItemId: id, error: message })
          errors.push({ id, message })
        }
      }
    }
    const workers = Array.from({ length: Math.min(targetConcurrency, queue.length) }, () => worker())
    await Promise.all(workers)
    if (errors.length) {
      // Surface the first failure (others already logged)
      throw new Error(`outline_generation_failed: ${errors[0]!.id}: ${errors[0]!.message}`)
    }
  }
  if (queueEnabled() && result.draftIds.length) {
    const queueResults = await Promise.allSettled(
      result.draftIds.map(async (planItemId) => {
        log.debug('[plan] queue generate job', { websiteId, planItemId })
        await publishJob({ type: 'generate', payload: { websiteId, planItemId } })
      })
    )
    for (const [idx, res] of queueResults.entries()) {
      if (res.status === 'rejected') {
        log.debug('[plan] queue generate failed', {
          websiteId,
          planItemId: result.draftIds[idx],
          error: res.reason instanceof Error ? res.reason.message : String(res.reason)
        })
      }
    }
  }
  try { await websitesRepo.patch(websiteId, { status: 'articles_scheduled' }) } catch {}
  const counts = await planRepo.counts(String(websiteId))
  log.debug('[plan] completed', { websiteId })
}
