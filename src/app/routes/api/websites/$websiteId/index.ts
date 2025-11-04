// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, requireSession, requireWebsiteAccess } from '@app/api-utils'
import { websitesRepo } from '@entities/website/repository'

export const Route = createFileRoute('/api/websites/$websiteId/')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        await requireSession(request)
        await requireWebsiteAccess(request, params.websiteId)
        const website = await websitesRepo.get(params.websiteId)
        if (!website) return httpError(404, 'Website not found')
        return json(website)
      },
      PATCH: async ({ params, request }) => {
        await requireSession(request)
        await requireWebsiteAccess(request, params.websiteId)
        const body = await request.json().catch(() => ({}))
        const patch: any = {}
        if (typeof body?.summary === 'string') patch.summary = body.summary
        if (body?.settings && typeof body.settings === 'object') {
          const s = body.settings
          const allowYoutube = s.allowYoutube === undefined ? undefined : Boolean(s.allowYoutube)
          const maxImages = s.maxImages === undefined ? undefined : Math.max(0, Math.min(4, Number(s.maxImages)))
          patch.settings = { ...((await websitesRepo.get(params.websiteId))?.settings || {}), ...(allowYoutube === undefined ? {} : { allowYoutube }), ...(maxImages === undefined ? {} : { maxImages }) }
        }
        const updated = await websitesRepo.patch(params.websiteId, patch)
        if (!updated) return httpError(404, 'Website not found')
        return json(updated)
      }
    }
  }
})
