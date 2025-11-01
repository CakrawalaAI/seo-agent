// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, requireSession, requireProjectAccess } from '@app/api-utils'
import { projectsRepo } from '@entities/project/repository'
import { hasDatabase, getDb } from '@common/infra/db'
import { eq } from 'drizzle-orm'
import { projectIntegrations } from '@entities/integration/db/schema'
import { latestRunDir } from '@common/bundle/store'
import { join } from 'node:path'
import { readFileSync, existsSync } from 'node:fs'
import { crawlRepo } from '@entities/crawl/repository'
import { keywordsRepo } from '@entities/keyword/repository'
import { articlesRepo } from '@entities/article/repository'

export const Route = createFileRoute('/api/projects/$projectId/snapshot')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        await requireSession(request)
        await requireProjectAccess(request, params.projectId)
        const project = await projectsRepo.get(params.projectId)
        if (!project) return httpError(404, 'Project not found')
        if (hasDatabase()) {
          try {
            const db = getDb()
            const [draftArticles, ints] = await Promise.all([
              articlesRepo.list(params.projectId, 120),
              db.select().from(projectIntegrations).where(eq(projectIntegrations.projectId, params.projectId))
            ])
            const crawlPages = await crawlRepo.list(params.projectId, 50)
            const keywords = await keywordsRepo.list(params.projectId, { status: 'all', limit: 50 })
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
              queueDepth: 0,
              planItems: draftArticles.filter((a) => (a.status ?? 'draft') === 'draft'),
              integrations: ints,
              crawlPages,
              keywords,
              latestDiscovery: siteSummary ? { providersUsed: ['llm'], status: 'completed', summaryJson: siteSummary } : null,
              representatives: reps
            })
          } catch {}
        }
        const [crawlPages, keywords] = await Promise.all([
          crawlRepo.list(params.projectId, 50),
          keywordsRepo.list(params.projectId, { status: 'all', limit: 50 })
        ])
        return json({ queueDepth: 0, planItems: [], integrations: [], crawlPages, keywords, latestDiscovery: null })
      }
    }
  }
})
