// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError } from '@app/api-utils'
import { projectsRepo } from '@entities/project/repository'
import { planRepo } from '@entities/plan/repository'
import { articlesRepo } from '@entities/article/repository'
import { crawlRepo } from '@entities/crawl/repository'
import { keywordsRepo } from '@entities/keyword/repository'
import { discoveryRepo } from '@entities/discovery/repository'
import { listJobs } from '@common/infra/jobs'
import { integrationsRepo } from '@entities/integration/repository'
import { hasDatabase, getDb } from '@common/infra/db'
import { planItems } from '@entities/plan/db/schema'
import { projectIntegrations } from '@entities/integration/db/schema'
import { crawlPages } from '@entities/crawl/db/schema'
import { keywords } from '@entities/keyword/db/schema'
import { eq } from 'drizzle-orm'

export const Route = createFileRoute('/api/projects/$projectId/snapshot')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const project = projectsRepo.get(params.projectId)
        if (!project) return httpError(404, 'Project not found')
        const jobs = listJobs(params.projectId, 50)
        const inflight = jobs.filter((j) => j.status === 'queued' || j.status === 'running')
        if (hasDatabase()) {
          try {
            const db = getDb()
            // @ts-ignore
            const [pItems, ints, cPages, kws] = await Promise.all([
              db.select().from(planItems).where(eq(planItems.projectId, params.projectId)).limit(90),
              db.select().from(projectIntegrations).where(eq(projectIntegrations.projectId, params.projectId)),
              db.select().from(crawlPages).where(eq(crawlPages.projectId, params.projectId)).limit(50),
              db.select().from(keywords).where(eq(keywords.projectId, params.projectId)).limit(50)
            ])
            return json({
              queueDepth: inflight.length,
              planItems: pItems,
              integrations: ints,
              crawlPages: cPages,
              keywords: kws,
              latestDiscovery: discoveryRepo.latest(params.projectId)
            })
          } catch {}
        }
        return json({
          queueDepth: inflight.length,
          planItems: planRepo.list(params.projectId, 90),
          integrations: integrationsRepo.list(params.projectId),
          crawlPages: crawlRepo.list(params.projectId, 50),
          keywords: keywordsRepo.list(params.projectId, { status: 'all', limit: 50 }),
          latestDiscovery: discoveryRepo.latest(params.projectId)
        })
      }
    }
  }
})
