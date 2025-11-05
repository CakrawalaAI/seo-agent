import { queueEnabled, publishJob } from '@common/infra/queue'
import { recordJobQueued } from '@common/infra/jobs'
import { env } from '@common/infra/env'
import { crawlRepo } from '@entities/crawl/repository'
import { websitesRepo } from '@entities/website/repository'
import { log } from '@src/common/logger'

export type RetriggerCrawlResult =
  | { status: 'running'; jobId: string; nextEligibleAt: string | null }
  | { status: 'cooldown'; jobId: null; nextEligibleAt: string }
  | { status: 'queued'; jobId: string | null; nextEligibleAt: string | null }
  | { status: 'disabled'; jobId: null; nextEligibleAt: string | null }

export async function retriggerCrawl(options: { websiteId: string; triggeredBy?: string | null }): Promise<RetriggerCrawlResult> {
  const websiteId = options.websiteId
  const now = new Date()

  const active = await crawlRepo.findActiveJob(websiteId)
  if (active) {
    const nextEligible = computeNextEligible(active.completedAt ?? active.startedAt, now, env.crawlCooldownHours)
    log.info('[crawl.retrigger] existing run active; skipping enqueue', { websiteId, jobId: active.id })
    return { status: 'running', jobId: active.id, nextEligibleAt: nextEligible }
  }

  const latest = await crawlRepo.getLatestJob(websiteId)
  const cooldownMs = Math.max(0, env.crawlCooldownHours) * 60 * 60 * 1000
  if (latest && cooldownMs > 0) {
    const eligibleAtIso = computeNextEligible(latest.completedAt ?? latest.startedAt ?? latest.createdAt, now, env.crawlCooldownHours)
    if (eligibleAtIso) {
      const eligibleAt = new Date(eligibleAtIso)
      if (eligibleAt.getTime() > now.getTime()) {
        log.info('[crawl.retrigger] cooldown enforced', { websiteId, latestJobId: latest.id, eligibleAt: eligibleAtIso })
        return { status: 'cooldown', jobId: null, nextEligibleAt: eligibleAtIso }
      }
    }
  }

  try {
    await websitesRepo.patch(websiteId, { summary: null, seedKeywords: null, status: 'crawling' })
  } catch (error) {
    log.warn('[crawl.retrigger] failed to mark website stale', { websiteId, error: (error as Error)?.message || String(error) })
  }

  if (!queueEnabled()) {
    log.warn('[crawl.retrigger] queue disabled; returning without enqueue', { websiteId })
    return { status: 'disabled', jobId: null, nextEligibleAt: null }
  }

  const jobId = await publishJob({ type: 'crawl', payload: { websiteId, trigger: 'manual', triggeredBy: options.triggeredBy ?? null } })
  recordJobQueued(websiteId, 'crawl', jobId)

  const nextEligible = computeNextEligible(now.toISOString(), now, env.crawlCooldownHours)
  log.info('[crawl.retrigger] crawl queued', { websiteId, jobId })
  return { status: 'queued', jobId, nextEligibleAt: nextEligible }
}

function computeNextEligible(reference: unknown, now: Date, cooldownHours: number): string | null {
  if (!reference) return null
  if (!Number.isFinite(cooldownHours) || cooldownHours <= 0) return null
  const dt = typeof reference === 'string' || reference instanceof Date ? new Date(reference) : null
  if (!dt || Number.isNaN(dt.getTime())) return null
  const base = dt.getTime()
  const cooldownMs = cooldownHours * 60 * 60 * 1000
  const target = base + cooldownMs
  if (target <= now.getTime()) return null
  return new Date(target).toISOString()
}
