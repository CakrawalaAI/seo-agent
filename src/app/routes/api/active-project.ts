// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession } from '@app/api-utils'
import { session } from '@common/infra/session'

export const Route = createFileRoute('/api/active-project')({
  server: {
    handlers: {
      GET: safeHandler(async ({ request }) => {
        const s = session.read(request)
        return json({ activeProjectId: s?.activeProjectId ?? null })
      }),
      POST: safeHandler(async ({ request }) => {
        const sess = await requireSession(request)
        const body = await request.json().catch(() => ({}))
        const projectId = typeof body?.projectId === 'string' ? body.projectId : null
        // persist alongside prior cookie fields
        const prev = session.read(request) || { user: sess.user ?? null, activeOrg: sess.activeOrg ?? null }
        const cookie = session.set({ ...prev, activeProjectId: projectId })
        return json({ activeProjectId: projectId }, { headers: { 'set-cookie': cookie } })
      })
    }
  }
})

