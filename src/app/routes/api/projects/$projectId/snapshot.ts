// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, requireSession, requireProjectAccess } from '@app/api-utils'
import { projectsRepo } from '@entities/project/repository'
import { hasDatabase, getDb } from '@common/infra/db'
import { jobs } from '@entities/job/db/schema'
import { desc, eq, and } from 'drizzle-orm'
import { articles } from '@entities/article/db/schema'
import { projectIntegrations } from '@entities/integration/db/schema'
import { crawlPages } from '@entities/crawl/db/schema'
import { keywords } from '@entities/keyword/db/schema'
import { latestRunDir } from '@common/bundle/store'
import { join } from 'node:path'
import { readFileSync, existsSync } from 'node:fs'

export const Route = createFileRoute('/api/projects/$projectId/snapshot')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        await requireSession(request)
        await requireProjectAccess(request, params.projectId)
        const project = await projectsRepo.get(params.projectId)
        if (!project) return httpError(404, 'Project not found')
        let inflightCount = 0
        if (hasDatabase()) {
          try {
            const db = getDb()
            // @ts-ignore
            const [pItems, ints, cPages, kws, jobRows] = await Promise.all([
              db.select().from(articles).where(and(eq(articles.projectId, params.projectId), eq(articles.status as any, 'planned' as any))).limit(90),
              db.select().from(projectIntegrations).where(eq(projectIntegrations.projectId, params.projectId)),
              db.select().from(crawlPages).where(eq(crawlPages.projectId, params.projectId)).limit(50),
              db.select().from(keywords).where(eq(keywords.projectId, params.projectId)).limit(50),
              db.select().from(jobs).where(eq(jobs.projectId, params.projectId)).orderBy(desc(jobs.queuedAt)).limit(100)
            ])
            inflightCount = (jobRows || []).filter((j: any) => j.status === 'queued' || j.status === 'running').length
            // Try reading bundle artifacts for summary and representatives
            let siteSummary: any = null
            let reps: string[] | null = null
            try {
              const base = latestRunDir(params.projectId)
              const sumFile = join(base, 'summary', 'site_summary.json')
              const repFile = join(base, 'crawl', 'representatives.json')
              if (existsSync(sumFile)) {
                siteSummary = JSON.parse(readFileSync(sumFile, 'utf-8'))
              }
              if (existsSync(repFile)) {
                const r = JSON.parse(readFileSync(repFile, 'utf-8'))
                if (Array.isArray(r?.urls)) reps = r.urls
              }
            } catch {}
            return json({
              queueDepth: inflightCount,
              planItems: pItems,
              integrations: ints,
              crawlPages: cPages,
              keywords: kws,
              latestDiscovery: siteSummary ? { providersUsed: ['llm'], status: 'completed', summaryJson: siteSummary } : null,
              representatives: reps
            })
          } catch {}
        }
        // DB is required for snapshot; if unavailable, return minimal object
        return json({ queueDepth: inflightCount, planItems: [], integrations: [], crawlPages: [], keywords: [], latestDiscovery: null })
      }
    }
  }
})
