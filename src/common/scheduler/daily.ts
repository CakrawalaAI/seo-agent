// website-first scheduler
import { websitesRepo } from '@entities/website/repository'
import { articlesRepo } from '@entities/article/repository'
import { websiteIntegrationsRepo } from '@entities/integration/repository.website'
import { queueEnabled, publishJob } from '@common/infra/queue'
import { env } from '@common/infra/env'
import { log } from '@src/common/logger'
import { requirePostEntitlement } from '@common/infra/entitlements'

function ymd(d: Date) { return d.toISOString().slice(0, 10) }
function addDays(base: Date, days: number) {
  const copy = new Date(base)
  copy.setUTCDate(copy.getUTCDate() + days)
  return copy
}

export async function runDailySchedules(opts: { websiteId?: string } = {}) {
  const today = ymd(new Date())
  // Prefer websites model; fallback to projects for legacy paths
  const websites = await (async () => {
    try {
      if (opts.websiteId) {
        const w = await websitesRepo.get(opts.websiteId)
        return w ? [w] : []
      }
      return await websitesRepo.list({ limit: 500 })
    } catch { return [] }
  })()
  const projectList = websites.map((w: any) => ({ id: w.id, orgId: w.orgId, planningApproved: true }))
  let queuedGenerations = 0
  let queuedPublishes = 0
  for (const project of projectList) {
    const projectId = project.id
    if (!project.planningApproved) continue
    const articles = await articlesRepo.list(projectId, 365)
    const integrations = await websiteIntegrationsRepo.list(projectId)
    const publishTarget = (integrations as any[]).find((i) => i.status === 'connected' && env.publicationAllowed.includes(String(i.type)))
    // Global lookahead window (default 3 days)
    const bufferDays = Math.max(0, Number(env.bufferDays ?? 3))
    const threshold = ymd(addDays(new Date(), bufferDays))
    // helper: subscription active for a given plan date
    const allowsDate = async (isoDate: string) => {
      if (!project.orgId) return true
      try {
        const check = await requirePostEntitlement(project.orgId)
        if (!check.allowed) return false
        const activeUntil = (check.entitlements as any)?.activeUntil || (check.entitlements as any)?.trialEndsAt || null
        if (!activeUntil) return true
        const cutoff = ymd(new Date(activeUntil))
        return isoDate <= cutoff
      } catch { return true }
    }
    const firstInit = !articles.some((a) => (a.status || '').toLowerCase() === 'scheduled' || (a.status || '').toLowerCase() === 'published')
    for (const article of articles) {
      const plannedDate = (article as any).scheduledDate
      if (!plannedDate) continue
      // Generate for buffer window [today .. today+bufferDays]
      if (article.status === 'queued' && plannedDate <= threshold && (await allowsDate(plannedDate))) {
        if (queueEnabled()) {
          const publishAfterGenerate = firstInit && plannedDate === today
          await publishJob({ type: 'generate', payload: { websiteId: projectId, planItemId: article.id, publishAfterGenerate } as any })
          queuedGenerations++
        }
      } else if (article.status === 'scheduled' && plannedDate <= today && publishTarget) {
        if (queueEnabled()) {
          await publishJob({ type: 'publish', payload: { articleId: article.id, integrationId: (publishTarget as any).id } })
          queuedPublishes++
        }
      }
    }
  }
  log.info('[scheduler] daily run', { today, queuedGenerations, queuedPublishes })
  return { queuedGenerations, queuedPublishes }
}
