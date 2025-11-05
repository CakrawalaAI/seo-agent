// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession, requireWebsiteAccess } from '@app/api-utils'
import { queueEnabled, publishJob } from '@common/infra/queue'
import { recordJobQueued } from '@common/infra/jobs'
import { env } from '@common/infra/env'
import { getKeywordRegenerateConfig, setKeywordRegenerateConfig } from '@entities/keyword/config'
import { websitesRepo } from '@entities/website/repository'
import { log } from '@src/common/logger'

const COOLDOWN_DEFAULT_MS = env.keywordRegenerateCooldownHours * 60 * 60 * 1000

export const Route = createFileRoute('/api/websites/$websiteId/keywords/regenerate')({
  server: {
    handlers: {
      POST: safeHandler(async ({ params, request }) => {
        await requireSession(request)
        const websiteId = String(params.websiteId)
        await requireWebsiteAccess(request, websiteId)

        const cooldownMs = Number.isFinite(COOLDOWN_DEFAULT_MS) ? Math.max(0, COOLDOWN_DEFAULT_MS) : 0
        const cfg = (await getKeywordRegenerateConfig(websiteId)) || {}
        const now = new Date()

        const lastStatus = cfg.lastStatus || null
        const lastRequestedAt = cfg.lastRequestedAt ? new Date(cfg.lastRequestedAt) : null
        const lastFailedAt = cfg.lastFailedAt ? new Date(cfg.lastFailedAt) : null
        const cooldownUntil = lastRequestedAt ? new Date(lastRequestedAt.getTime() + cooldownMs) : null

        const failureAllowsRetry = lastStatus === 'failed' && (!cfg.lastCompletedAt || (lastFailedAt && new Date(cfg.lastCompletedAt) <= lastFailedAt))

        if (!failureAllowsRetry && cooldownMs > 0 && cooldownUntil && cooldownUntil.getTime() > now.getTime()) {
          const remaining = Math.max(0, Math.ceil((cooldownUntil.getTime() - now.getTime()) / 1000))
          log.info('[api.keywords.regenerate] cooldown active', { websiteId, remainingSeconds: remaining, lastStatus })
          return json(
            {
              status: 'cooldown',
              cooldownExpiresAt: cooldownUntil.toISOString(),
              secondsRemaining: remaining,
              jobId: cfg.lastJobId ?? null
            },
            { status: lastStatus === 'queued' ? 202 : 429 }
          )
        }

        const website = await websitesRepo.get(websiteId)
        if (!website) return httpError(404, 'Website not found')
        const seedCount = Array.isArray(website.seedKeywords) ? website.seedKeywords.length : 0
        if (!seedCount) return httpError(400, 'No seed keywords stored for this website')

        const requestId = genId('kwregen')
        if (!queueEnabled()) {
          await setKeywordRegenerateConfig(websiteId, {
            lastRequestedAt: now.toISOString(),
            lastStatus: 'queued',
            lastRequestId: requestId,
            lastJobId: null
          })
          log.warn('[api.keywords.regenerate] queue disabled; request accepted without job', { websiteId })
          return json({ status: 'queued', jobId: null, requestId, cooldownExpiresAt: cooldownMs ? new Date(now.getTime() + cooldownMs).toISOString() : null }, { status: 202 })
        }

        const payload = { websiteId, mode: 'regenerate', requestId }
        const jobId = await publishJob({ type: 'generateKeywords', payload })
        recordJobQueued(websiteId, 'generateKeywords', jobId)
        await setKeywordRegenerateConfig(websiteId, {
          lastRequestedAt: now.toISOString(),
          lastStatus: 'queued',
          lastRequestId: requestId,
          lastJobId: jobId
        })
        log.info('[api.keywords.regenerate] queued', { websiteId, jobId, requestId, seedCount })
        return json(
          {
            status: 'queued',
            jobId,
            requestId,
            cooldownExpiresAt: cooldownMs ? new Date(now.getTime() + cooldownMs).toISOString() : null
          },
          { status: 202 }
        )
      })
    }
  }
})

function genId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}
