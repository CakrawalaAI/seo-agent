// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession } from '@app/api-utils'
import { session } from '@common/infra/session'
import { hasDatabase, getDb } from '@common/infra/db'
import { orgs, orgMembers } from '@entities/org/db/schema'
import { eq } from 'drizzle-orm'

export const Route = createFileRoute('/api/orgs')({
  server: {
    handlers: {
      GET: safeHandler(async ({ request }) => {
        const sess = await requireSession(request)
        if (hasDatabase()) {
          try {
            const db = getDb()
            if (!sess.user?.email) return json({ items: [] })
            // @ts-ignore
            const rows = await db.select().from(orgs).limit(500)
            // @ts-ignore
            const mems = await db.select().from(orgMembers).where(eq(orgMembers.userEmail, sess.user.email)).limit(500)
            const allowed = new Set<string>(mems.map((m: any) => String(m.orgId)))
            const items = rows.filter((o: any) => allowed.has(String(o.id)))
            return json({ items })
          } catch {}
        }
        return json({ items: [] })
      }),
      POST: safeHandler(async ({ request }) => {
        const sess = await requireSession(request)
        const body = await request.json().catch(() => ({}))
        const action = body?.action
        if (action === 'switch') {
          const orgId = String(body?.orgId || '')
          if (!orgId) return httpError(400, 'Missing orgId')
          const current = session.read(request) || { user: null }
          const updated = { ...(current || {}), activeOrg: { id: orgId } }
          const cookie = session.set(updated as any)
          return new Response(null, { status: 204, headers: { 'Set-Cookie': cookie } })
        }
        // Invitations removed
        return httpError(400, 'Unsupported action')
      })
    }
  }
})
