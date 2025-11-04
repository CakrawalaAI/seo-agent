// @ts-nocheck
import crypto from 'crypto'
import { createFileRoute } from '@tanstack/react-router'
import { httpError, safeHandler } from '@app/api-utils'
import { clearTempCookie, exchangeCodeForTokens, fetchGoogleUser, parseTempCookie, sanitizeRedirect, upsertUserFromGoogle } from '@common/auth/google'
import { hasDatabase, getDb } from '@common/infra/db'
import { session } from '@common/infra/session'
import { organizations, organizationMembers } from '@entities/org/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { log } from '@src/common/logger'

export const Route = createFileRoute('/api/auth/callback')({
  server: {
    handlers: {
      GET: safeHandler(async ({ request }) => {
        const url = new URL(request.url)
        const code = url.searchParams.get('code')
        const state = url.searchParams.get('state')
        if (!code || !state) return httpError(400, 'Missing code/state')
        const tmp = parseTempCookie(request)
        if (!tmp?.state || tmp.state !== state) return httpError(400, 'Invalid state')
        const redirectTo = sanitizeRedirect(tmp.redirectTo || '/dashboard')

        // Debug logging removed (no flag)
        const tokens = await exchangeCodeForTokens(request, code)
        const profile = await fetchGoogleUser(tokens.access_token)
        if (!profile.email) return httpError(400, 'Google profile missing email')
        const { userId } = await upsertUserFromGoogle({ sub: profile.sub, email: profile.email, name: profile.name, picture: profile.picture ?? null })

        let activeOrg: { id: string; plan?: string } | undefined
        if (hasDatabase()) {
          try {
            const db = getDb()
            let membs = (await db.select().from(organizationMembers).where(eq(organizationMembers.userEmail, profile.email)).limit(25)) as any[]
            if (!membs.length) {
              const orgId = `org_${crypto.randomBytes(6).toString('hex')}`
              const baseName =
                profile.name?.trim() ||
                profile.email?.split('@')?.[0]?.trim() ||
                'My'
              const orgName = baseName.endsWith('s') ? `${baseName}' Workspace` : `${baseName}'s Workspace`
              await db.insert(organizations).values({ id: orgId, name: orgName })
              await db.insert(organizationMembers).values({ orgId, userEmail: profile.email, role: 'owner' })
              membs = [{ orgId, userEmail: profile.email, role: 'owner' }]
              activeOrg = { id: orgId, plan: 'starter' }
            }
            if (!activeOrg && membs.length) {
              const ids = Array.from(new Set<string>(membs.map((m) => String(m.orgId))))
              if (ids.length) {
                const joined = (await db.select().from(organizations).where(inArray(organizations.id, ids)).limit(ids.length)) as any[]
                if (joined.length) activeOrg = { id: joined[0]!.id, plan: joined[0]!.plan }
              }
            }
          } catch (error) {
            log.error('[auth/callback] failed to resolve organization', { error })
          }
        }

        const payload = { user: { email: profile.email, name: profile.name ?? null }, activeOrg }
        const cookie = session.set(payload)
        const headers = new Headers()
        headers.set('Location', redirectTo)
        headers.append('Set-Cookie', cookie)
        headers.append('Set-Cookie', clearTempCookie())
        // Debug logging removed (no flag)
        return new Response(null, { status: 302, headers })
      }),
    },
  },
})
