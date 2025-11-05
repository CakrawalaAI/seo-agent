import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, requireSession, requireWebsiteAccess, safeHandler } from '@app/api-utils'
import { publishDashboardProgress } from '@common/realtime/hub'

export const Route = createFileRoute('/api/websites/$websiteId/progress')({
  server: {
    handlers: {
      POST: safeHandler(async ({ request, params }) => {
        await requireSession(request)
        await requireWebsiteAccess(request, params.websiteId)
        let body: unknown
        try {
          body = await request.json()
        } catch {
          throw httpError(400, 'Invalid JSON body')
        }
        if (!body || typeof body !== 'object' || !('payload' in body)) {
          throw httpError(400, 'Missing payload')
        }
        const payload = (body as any).payload
        await publishDashboardProgress(params.websiteId, payload, { skipRelay: true })
        return json({ ok: true })
      })
    }
  }
})
