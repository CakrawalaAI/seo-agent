// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler } from './utils'
import { projectsRepo } from '@entities/project/repository'

export const Route = createFileRoute('/api/projects')({
  server: {
    handlers: {
      GET: safeHandler(({ request }) => {
        const url = new URL(request.url)
        const limit = Number(url.searchParams.get('limit') || '50')
        const orgId = url.searchParams.get('orgId') || undefined
        const items = projectsRepo.list({ orgId: orgId || undefined, limit: Number.isFinite(limit) ? limit : 50 })
        return json({ items })
      }),
      POST: safeHandler(async ({ request }) => {
        const body = await request.json().catch(() => ({}))
        if (!body?.orgId || !body?.name || !body?.siteUrl || !body?.defaultLocale) {
          return httpError(400, 'Missing required fields')
        }
        const project = projectsRepo.create({
          orgId: String(body.orgId),
          name: String(body.name),
          siteUrl: String(body.siteUrl),
          defaultLocale: String(body.defaultLocale)
        })
        return json({ project, crawlJobId: null }, { status: 201 })
      })
    }
  }
})

