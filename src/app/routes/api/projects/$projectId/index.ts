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
        const body = await request.json().catch(() => ({}))
        const patch: any = {}
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
        const updated = await projectsRepo.patch(params.projectId, patch)
        return json(updated)
      })
    }
  }
})
