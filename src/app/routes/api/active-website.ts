// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, safeHandler, requireSession } from '@app/api-utils'
import { session } from '@common/infra/session'

export const Route = createFileRoute('/api/active-website')({
  server: {
    handlers: {
      GET: safeHandler(async ({ request }) => {
        const s = session.read(request)
        return json({ activeWebsiteId: s?.activeWebsiteId ?? s?.activeProjectId ?? null })
      }),
      POST: safeHandler(async ({ request }) => {
        const sess = await requireSession(request)
        const body = await request.json().catch(() => ({}))
        const websiteId = typeof body?.websiteId === 'string' ? body.websiteId : typeof body?.projectId === 'string' ? body.projectId : null
        const prev = session.read(request) || { user: sess.user ?? null, activeOrg: sess.activeOrg ?? null }
        const cookie = session.set({ ...prev, activeWebsiteId: websiteId, activeProjectId: websiteId })
        return json({ activeWebsiteId: websiteId }, { headers: { 'set-cookie': cookie } })
      })
    }
  }
})

