// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession, requireProjectAccess } from '@app/api-utils'
import { projectsRepo } from '@entities/project/repository'
import { hasDatabase, getDb } from '@common/infra/db'
import { projects } from '@entities/project/db/schema'
import { eq } from 'drizzle-orm'
import { planItems } from '@entities/plan/db/schema'
import { articles } from '@entities/article/db/schema'
import { keywords } from '@entities/keyword/db/schema'
import { crawlPages, linkGraph } from '@entities/crawl/db/schema'
import { projectIntegrations } from '@entities/integration/db/schema'
import { jobs } from '@entities/job/db/schema'
import { metricCache } from '@entities/metrics/db/schema'
import { planRepo } from '@entities/plan/repository'
import { articlesRepo } from '@entities/article/repository'
import { keywordsRepo } from '@entities/keyword/repository'
import { crawlRepo } from '@entities/crawl/repository'
import { integrationsRepo } from '@entities/integration/repository'

export const Route = createFileRoute('/api/projects/$projectId/')({
  server: {
    handlers: {
      GET: safeHandler(async ({ params }) => {
        if (hasDatabase()) {
          try {
            const db = getDb()
            // @ts-ignore
            const rows = await (db.select().from(projects).where(eq(projects.id, params.projectId)).limit(1) as any)
            const found = Array.isArray(rows) ? rows[0] : null
            if (found) return json(found)
          } catch {}
        }
        const project = projectsRepo.get(params.projectId)
        if (!project) return httpError(404, 'Project not found')
        return json(project)
      }),
      PATCH: safeHandler(async ({ params, request }) => {
        const body = await request.json().catch(() => ({}))
        if (hasDatabase()) {
          try {
            const db = getDb()
            await db.update(projects).set({
              name: body?.name,
              defaultLocale: body?.defaultLocale,
              siteUrl: body?.siteUrl,
              autoPublishPolicy: body?.autoPublishPolicy,
              status: body?.status,
              crawlMaxDepth: typeof body?.crawlMaxDepth === 'number' ? body.crawlMaxDepth : null,
              crawlBudgetPages: typeof body?.crawlBudgetPages === 'number' ? body.crawlBudgetPages : null,
              bufferDays: typeof body?.bufferDays === 'number' ? body.bufferDays : null,
              updatedAt: new Date() as any
            }).where(eq(projects.id, params.projectId))
          } catch {}
        }
        const updated = projectsRepo.patch(params.projectId, body)
        if (!updated) return httpError(404, 'Project not found')
        return json(updated)
      })
      ,
      DELETE: safeHandler(async ({ params, request }) => {
        requireSession(request)
        await requireProjectAccess(request, params.projectId)
        if (hasDatabase()) {
          try {
            const db = getDb()
            // @ts-ignore
            await db.delete(planItems).where(eq(planItems.projectId, params.projectId))
            // @ts-ignore
            await db.delete(articles).where(eq(articles.projectId, params.projectId))
            // @ts-ignore
            await db.delete(keywords).where(eq(keywords.projectId, params.projectId))
            // @ts-ignore
            await db.delete(crawlPages).where(eq(crawlPages.projectId, params.projectId))
            // @ts-ignore
            await db.delete(linkGraph).where(eq(linkGraph.projectId, params.projectId))
            // @ts-ignore
            await db.delete(projectIntegrations).where(eq(projectIntegrations.projectId, params.projectId))
            // @ts-ignore
            await db.delete(jobs).where(eq(jobs.projectId, params.projectId))
            // @ts-ignore
            await db.delete(metricCache).where(eq(metricCache.projectId, params.projectId))
            // @ts-ignore
            await db.delete(projects).where(eq(projects.id, params.projectId))
          } catch {}
        }
        planRepo.removeByProject(params.projectId)
        articlesRepo.removeByProject(params.projectId)
        keywordsRepo.removeByProject(params.projectId)
        crawlRepo.removeByProject(params.projectId)
        integrationsRepo.removeByProject(params.projectId)
        projectsRepo.remove(params.projectId)
        return new Response(null, { status: 204 })
      })
    }
  }
})
