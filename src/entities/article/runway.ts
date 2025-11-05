import { planRepo } from './planner'
import { websitesRepo } from '@entities/website/repository'
import { getEntitlements, mergeOrgEntitlements, defaultEntitlements } from '@common/infra/entitlements'
import { getSubscriptionEntitlementByOrg } from '@entities/subscription/service'
import { queueEnabled, publishJob } from '@common/infra/queue'
import { log } from '@src/common/logger'

const MS_PER_DAY = 24 * 60 * 60 * 1000

function startOfUtcDay(date: Date): Date {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * MS_PER_DAY)
}

function differenceInDays(a: Date, b: Date): number {
  const diff = startOfUtcDay(a).getTime() - startOfUtcDay(b).getTime()
  return Math.floor(diff / MS_PER_DAY)
}

function coerceDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  if (value instanceof Date) return new Date(value.getTime())
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export async function ensureArticleRunway(orgId: string): Promise<void> {
  const subscription = await getSubscriptionEntitlementByOrg(orgId)
  if (!subscription) return

  const status = String(subscription.status || '').toLowerCase()
  if (status !== 'trialing' && status !== 'active') return

  const entitlements = (await getEntitlements(orgId)) ?? defaultEntitlements()
  const trialState = ((entitlements as any)?.trial ?? {}) as {
    eligible?: boolean | null
    initialRunwaySeededAt?: string | null
    outlinesThrough?: string | null
  }

  const today = startOfUtcDay(new Date())
  const trialEndsAt = coerceDate(subscription.trialEndsAt ?? null)
  const periodEnd = coerceDate(subscription.currentPeriodEnd ?? null)

  let horizon: Date | null = null
  let markSeeded = false

  if (status === 'trialing') {
    const trialEnd = trialEndsAt ?? addDays(today, 3)
    if (!trialState?.initialRunwaySeededAt) {
      horizon = addDays(trialEnd, 30)
      markSeeded = true
    } else {
      horizon = addDays(trialEnd, 30)
    }
  } else if (status === 'active') {
    horizon = periodEnd ?? addDays(today, 30)
  }

  if (!horizon) return

  const totalDays = Math.min(90, Math.max(1, differenceInDays(horizon, today) + 1))
  if (totalDays <= 0) return

  const websites = await websitesRepo.list({ orgId, limit: 50 })
  if (!websites.length) return

  const draftDayTarget = Math.min(3, totalDays)

  for (const site of websites) {
    const { draftIds } = await planRepo.createPlan(site.id, totalDays, { draftDays: draftDayTarget })
    if (draftIds.length && queueEnabled()) {
      for (const articleId of draftIds.slice(0, draftDayTarget)) {
        await publishJob({ type: 'generate', payload: { websiteId: site.id, planItemId: articleId } as any })
      }
    }
  }

  const outlinesThroughIso = startOfUtcDay(horizon).toISOString().slice(0, 10)
  await mergeOrgEntitlements(orgId, (current) => {
    const next = { ...current }
    const trial = { ...(next.trial as Record<string, unknown> | undefined) } as any
    if (markSeeded && !trial.initialRunwaySeededAt) trial.initialRunwaySeededAt = new Date().toISOString()
    trial.outlinesThrough = outlinesThroughIso
    next.trial = trial
    return next
  })

  log.info('[runway] ensured article runway', {
    orgId,
    status,
    totalDays,
    horizon: outlinesThroughIso,
    websites: websites.length
  })
}

export async function ensureComplimentaryRunway(orgId: string, opts: { websiteId?: string | null } = {}): Promise<void> {
  const entitlements = (await getEntitlements(orgId)) ?? defaultEntitlements()
  const trial = entitlements.trial ?? defaultEntitlements().trial
  if (!trial?.eligible) return
  if (trial?.outlinesThrough) return

  const today = startOfUtcDay(new Date())
  const horizon = addDays(today, 32) // 33-day window (3-day trial + 30-day preview)
  const totalDays = Math.min(90, Math.max(1, differenceInDays(horizon, today) + 1))
  if (totalDays <= 0) return

  let usableSites: Array<{ id: string; orgId: string | null | undefined }> = []
  if (opts.websiteId) {
    const single = await websitesRepo.get(String(opts.websiteId))
    if (single && single.orgId === orgId) {
      usableSites = [{ id: single.id, orgId: single.orgId }]
    }
  } else {
    usableSites = (await websitesRepo.list({ orgId, limit: 50 })).map((site) => ({ id: site.id, orgId: site.orgId }))
  }
  if (!usableSites.length) return

  const draftDayTarget = Math.min(3, totalDays)

  for (const site of usableSites) {
    const { draftIds } = await planRepo.createPlan(site.id, totalDays, { draftDays: draftDayTarget })
    if (draftIds.length && queueEnabled()) {
      for (const articleId of draftIds.slice(0, draftDayTarget)) {
        await publishJob({ type: 'generate', payload: { websiteId: site.id, planItemId: articleId } as any })
      }
    }
  }

  const outlinesThroughIso = startOfUtcDay(horizon).toISOString().slice(0, 10)
  await mergeOrgEntitlements(orgId, (current) => {
    const next = { ...current }
    const trialState = { ...(next.trial as Record<string, unknown> | undefined) } as any
    if (!trialState.initialRunwaySeededAt) trialState.initialRunwaySeededAt = new Date().toISOString()
    trialState.outlinesThrough = outlinesThroughIso
    trialState.complimentaryLimit = trialState.complimentaryLimit ?? 3
    trialState.complimentaryUsed = trialState.complimentaryUsed ?? 0
    next.trial = trialState
    return next
  })

  log.info('[runway] complimentary runway ensured', {
    orgId,
    horizon: startOfUtcDay(horizon).toISOString().slice(0, 10),
    websites: usableSites.length,
    totalDays
  })
}
