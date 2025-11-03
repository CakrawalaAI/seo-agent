// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession, requireProjectAccess } from '@app/api-utils'
import { projectsRepo } from '@entities/project/repository'
import { hasDatabase, getDb } from '@common/infra/db'
import { projects } from '@entities/project/db/schema'
import { eq } from 'drizzle-orm'

export const Route = createFileRoute('/api/projects/$projectId/')({
  server: {
    handlers: {
      GET: safeHandler(async ({ params, request }) => {
        await requireSession(request)
        await requireProjectAccess(request, params.projectId)
        const p = await projectsRepo.get(params.projectId)
        if (!p) return httpError(404, 'Project not found')
        return json(p)
      }),
      PATCH: safeHandler(async ({ params, request }) => {
        await requireSession(request)
        await requireProjectAccess(request, params.projectId)
        const before = await projectsRepo.get(params.projectId)
        if (!before) return httpError(404, 'Project not found')
        const body = await request.json().catch(() => ({} as Record<string, unknown>))

        const patch: any = {}
        let queueDiscovery = false
        let queuePlan = false

        if (typeof body?.name === 'string') patch.name = body.name
        if (typeof body?.defaultLocale === 'string') patch.defaultLocale = body.defaultLocale
        if (typeof body?.siteUrl === 'string') patch.siteUrl = body.siteUrl
        if (typeof body?.autoPublishPolicy === 'string') patch.autoPublishPolicy = body.autoPublishPolicy
        if (typeof body?.serpDevice === 'string') patch.serpDevice = body.serpDevice
        if (body?.serpLocationCode !== undefined) {
          const value = Number(body.serpLocationCode)
          if (Number.isFinite(value)) patch.serpLocationCode = value
        }
        if (body?.metricsLocationCode !== undefined) {
          const value = Number(body.metricsLocationCode)
          if (Number.isFinite(value)) patch.metricsLocationCode = value
        }
        if (typeof body?.dfsLanguageCode === 'string' && body.dfsLanguageCode.trim()) {
          patch.dfsLanguageCode = body.dfsLanguageCode.trim()
        }
        if (typeof body?.businessSummary === 'string') {
          patch.businessSummary = body.businessSummary
        }
        if (body?.crawlBudget !== undefined) {
          const value = Number(body.crawlBudget)
          if (Number.isFinite(value)) {
            patch.crawlBudget = Math.max(1, Math.min(50, Math.floor(value)))
          }
        }

        const discoveryRequested = typeof body?.discoveryApproved === 'boolean' ? body.discoveryApproved : undefined
        if (discoveryRequested !== undefined) {
          if (discoveryRequested && !before.discoveryApproved) {
            patch.discoveryApproved = true
            patch.planningApproved = false
            patch.workflowState = 'discovering_keywords'
            queueDiscovery = true
          } else if (!discoveryRequested) {
            patch.discoveryApproved = false
            patch.planningApproved = false
            patch.workflowState = 'pending_summary_approval'
          }
        }

        const planningRequested = typeof body?.planningApproved === 'boolean' ? body.planningApproved : undefined
        const discoveryIsApproved = discoveryRequested !== undefined ? discoveryRequested : Boolean(before.discoveryApproved)
        if (planningRequested !== undefined) {
          if (planningRequested) {
            if (!discoveryIsApproved) {
              return httpError(400, 'Cannot approve planning before keyword discovery approval')
            }
            if (!before.planningApproved) {
              patch.planningApproved = true
              patch.workflowState = 'planning'
              queuePlan = true
            }
          } else {
            patch.planningApproved = false
            patch.workflowState = discoveryIsApproved ? 'pending_keywords_approval' : 'pending_summary_approval'
          }
        }

        const updated = await projectsRepo.patch(params.projectId, patch)

        if (queueDiscovery) {
          try {
            const { queueEnabled, publishJob } = await import('@common/infra/queue')
            const { recordJobQueued } = await import('@common/infra/jobs')
            if (queueEnabled()) {
              const locale = String(updated?.defaultLocale || before.defaultLocale || 'en-US')
              const jobId = await publishJob({ type: 'discovery', payload: { projectId: params.projectId, locale } })
              try { await recordJobQueued(params.projectId, 'discovery', jobId) } catch {}
            }
          } catch (err) {
            console.warn('[projects.patch] failed to queue discovery', { projectId: params.projectId, error: (err as Error)?.message || String(err) })
          }
        }

        if (queuePlan) {
          try {
            const { queueEnabled, publishJob } = await import('@common/infra/queue')
            const { recordJobQueued } = await import('@common/infra/jobs')
            if (queueEnabled()) {
              const days = Number(body?.planDays || 30)
              const jobId = await publishJob({ type: 'plan', payload: { projectId: params.projectId, days: Number.isFinite(days) && days > 0 ? days : 30 } })
              try { await recordJobQueued(params.projectId, 'plan', jobId) } catch {}
            }
          } catch (err) {
            console.warn('[projects.patch] failed to queue plan', { projectId: params.projectId, error: (err as Error)?.message || String(err) })
          }
        }

        return json(updated)
      })
    }
  }
})
