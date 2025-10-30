// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession } from '@app/api-utils'
import { projectsRepo } from '@entities/project/repository'
import { hasDatabase, getDb } from '@common/infra/db'
import { projects } from '@entities/project/db/schema'
import { eq } from 'drizzle-orm'

export const Route = createFileRoute('/api/projects/$projectId/')({
  server: {
    handlers: {
      GET: safeHandler(async ({ params }) => {
        const p = projectsRepo.get(params.projectId)
        if (!p) return httpError(404, 'Project not found')
        return json(p)
      }),
      PATCH: safeHandler(async ({ params, request }) => {
        await requireSession(request)
        const body = await request.json().catch(() => ({}))
        const patch: any = {}
        if (typeof body?.name === 'string') patch.name = body.name
        if (typeof body?.defaultLocale === 'string') patch.defaultLocale = body.defaultLocale
        if (typeof body?.siteUrl === 'string') patch.siteUrl = body.siteUrl
        if (typeof body?.autoPublishPolicy === 'string') patch.autoPublishPolicy = body.autoPublishPolicy
        if (typeof body?.serpDevice === 'string') patch.serpDevice = body.serpDevice
        if (typeof body?.serpLocationCode === 'number') patch.serpLocationCode = body.serpLocationCode
        if (typeof body?.metricsLocationCode === 'number') patch.metricsLocationCode = body.metricsLocationCode
        const updated = projectsRepo.patch(params.projectId, patch)
        if (hasDatabase()) {
          try {
            const db = getDb()
            await db.update(projects).set({
              name: updated?.name ?? null,
              defaultLocale: updated?.defaultLocale ?? null,
              siteUrl: updated?.siteUrl ?? null,
              autoPublishPolicy: updated?.autoPublishPolicy ?? null,
              serpDevice: updated?.serpDevice ?? null,
              serpLocationCode: updated?.serpLocationCode ?? null,
              metricsLocationCode: updated?.metricsLocationCode ?? null
            } as any).where(eq(projects.id, params.projectId))
          } catch {}
        }
        return json(updated)
      })
    }
  }
})
