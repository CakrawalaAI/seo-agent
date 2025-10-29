// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession } from '@app/api-utils'
import { session } from '@common/infra/session'
import { hasDatabase, getDb } from '@common/infra/db'
import { orgs, orgMembers } from '@entities/org/db/schema'

function parseToken(token: string): { orgId: string; email?: string | null } | null {
  try {
    const json = JSON.parse(Buffer.from(token, 'base64').toString('utf8'))
    if (json?.orgId) return { orgId: String(json.orgId), email: typeof json.email === 'string' ? json.email : null }
  } catch {}
  if (token.includes(':')) {
    const [orgId, email] = token.split(':')
    if (orgId) return { orgId, email: email || null }
  }
  return null
}

export const Route = createFileRoute('/api/orgs/invites/$token/accept')({
  server: {
    handlers: {
      POST: safeHandler(async ({ params, request }) => {
        const sess = await requireSession(request)
        const parsed = parseToken(params.token)
        if (!parsed) return httpError(400, 'Invalid token')
        const orgId = parsed.orgId
        const email = parsed.email || sess.user?.email || null
        if (hasDatabase()) {
          try {
            const db = getDb()
            await db.insert(orgs).values({ id: orgId, name: orgId }).onConflictDoNothing()
            if (email) {
              await db.insert(orgMembers).values({ orgId, userEmail: email, role: 'member' }).onConflictDoNothing?.()
            }
          } catch {}
        }
        // Update our cookie session active organization
        const current = session.read(request) || { user: null }
        const cookie = session.set({ ...(current as any), activeOrg: { id: orgId } })
        return new Response(null, { status: 204, headers: { 'Set-Cookie': cookie } })
      })
    }
  }
})
