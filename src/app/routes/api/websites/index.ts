// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession } from '@app/api-utils'
import { log } from '@src/common/logger'
import { websitesRepo } from '@entities/website/repository'

export const Route = createFileRoute('/api/websites/')({
  server: {
    handlers: {
      GET: safeHandler(async ({ request }) => {
        await requireSession(request)
        const url = new URL(request.url)
        const limit = Number(url.searchParams.get('limit') || '50')
        const items = await websitesRepo.list({ limit: Number.isFinite(limit) ? limit : 50 })
        return json({ items })
      }),
      POST: safeHandler(async ({ request }) => {
        const sess = await requireSession(request)
        const body = await request.json().catch(() => ({}))
        const orgId = sess?.activeOrg?.id
        const url = String(body?.url || '')
        const defaultLocale = String(body?.defaultLocale || 'en-US')
        if (!orgId || !url) return httpError(400, 'Missing org or url')
        log.debug('[websites.create] request', { orgId, url, defaultLocale })
        const w = await websitesRepo.create({ orgId, url, defaultLocale })
        log.debug('[websites.create] created website', { websiteId: w.id })
        return json({ website: w }, { status: 201 })
      })
    }
  }
})
