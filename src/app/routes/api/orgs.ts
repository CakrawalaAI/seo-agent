// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession } from '@app/api-utils'
import { auth } from '@common/auth/server'
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
            // @ts-ignore
            const rows = await (db.select().from(orgs).limit(100) as any)
            return json({ items: rows })
          } catch {}
        }
        return json({ items: sess.orgs ?? [] })
      }),
      POST: safeHandler(async ({ request }) => {
        const sess = await requireSession(request)
        const body = await request.json().catch(() => ({}))
        const action = body?.action
        if (action === 'switch') {
          const orgId = String(body?.orgId || '')
          if (!orgId) return httpError(400, 'Missing orgId')
          // Set Better Auth active organization in session
          const resp = await auth.api.setActiveOrganization({
            headers: request.headers as any,
            body: { organizationId: orgId },
            asResponse: true
          })
          return resp
        }
        if (action === 'invite') {
          const email = String(body?.email || '')
          if (!email) return httpError(400, 'Missing email')
          const orgId = sess.activeOrg?.id || 'org-dev'
          // create invitation token (base64 json)
          const token = Buffer.from(JSON.stringify({ orgId, email })).toString('base64')
          // send stub email
          try { const { sendEmailStub } = await import('@common/infra/email'); await sendEmailStub({ to: email, subject: 'SEO Agent org invite', text: `Accept: /api/orgs/invites/${token}/accept` }) } catch {}
          if (hasDatabase()) {
            try {
              const db = getDb()
              // Upsert org row to ensure it exists
              await db.insert(orgs).values({ id: orgId, name: orgId }).onConflictDoNothing()
              // Add membership
              await db.insert(orgMembers).values({ orgId, userEmail: email, role: 'member' }).onConflictDoNothing?.()
            } catch {}
          }
          return json({ ok: true, token })
        }
        return httpError(400, 'Unsupported action')
      })
    }
  }
})
