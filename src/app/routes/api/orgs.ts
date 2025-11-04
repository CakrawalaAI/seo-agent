// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession } from '@app/api-utils'
import { session } from '@common/infra/session'
import { sendEmail } from '@common/infra/email'
import { hasDatabase, getDb } from '@common/infra/db'
import { orgs, orgMembers } from '@entities/org/db/schema'
import { eq } from 'drizzle-orm'
import { log } from '@src/common/logger'

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
        if (action === 'invite') {
          const email = String(body?.email || '')
          if (!email) return httpError(400, 'Missing email')
          const orgId = String(sess.activeOrg?.id || '')
          if (!orgId) return httpError(400, 'Active organization required')
          const normalizedEmail = email.trim().toLowerCase()
          if (!normalizedEmail) return httpError(400, 'Invalid email')
          const role = body?.role === 'owner' ? 'owner' : 'member'
          if (hasDatabase()) {
            try {
              const db = getDb()
              await db
                .insert(orgMembers)
                .values({ orgId, userEmail: normalizedEmail, role })
                .onConflictDoUpdate({ target: [orgMembers.orgId, orgMembers.userEmail], set: { role } as any })
            } catch (error) {
              log.error('Invite insert failed', error)
            }
          }
          const token = `stub_${Date.now().toString(36)}`
          const inviter = sess.user?.email ? `by ${sess.user.email}` : ''
          const subject = `You're invited to ${orgId} on SEO Agent`
          const lines = [
            `You've been invited ${inviter} to collaborate on ${orgId}.`,
            `Role: ${role}.`,
            'Members can create and manage articles, keywords, and website settings.'
          ]
          const text = `${lines.join('\n')}`
          const html = `<p>${lines.join('</p><p>')}</p>`
          await sendEmail({ to: normalizedEmail, subject, text, html })
          return json({ token, email: normalizedEmail, role, orgId })
        }
        // Invitations removed
        return httpError(400, 'Unsupported action')
      })
    }
  }
})
