// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession } from '@app/api-utils'
import { projectsRepo } from '@entities/project/repository'
import { keywordsRepo } from '@entities/keyword/repository'
import { publishJob, queueEnabled } from '@common/infra/queue'

export const Route = createFileRoute('/api/projects/$projectId/competitors/warm')({
  server: {
    handlers: {
      POST: safeHandler(async ({ params, request }) => {
        await requireSession(request)
        const project = projectsRepo.get(params.projectId)
        if (!project) return httpError(404, 'Project not found')
        const url = new URL(request.url)
        const topM = Math.max(1, Math.min(50, Number(url.searchParams.get('topM') || '10')))
        const loc = Number(project?.serpLocationCode || project?.metricsLocationCode || 2840)
        const device = (project?.serpDevice as any) === 'mobile' ? 'mobile' : 'desktop'
        const list = (keywordsRepo.list(params.projectId, { status: 'all', limit: 1000 }) || [])
          .sort((a, b) => (b.opportunity ?? 0) - (a.opportunity ?? 0))
          .slice(0, topM)
        let queued = 0
        if (queueEnabled()) {
          for (const k of list) {
            await publishJob({ type: 'competitors', payload: { projectId: params.projectId, siteUrl: String(project?.siteUrl || ''), canonPhrase: k.phrase, language: project.defaultLocale || 'en-US', locationCode: loc, device, topK: 10 } })
            queued++
          }
        }
        return json({ queued })
      })
    }
  }
})

