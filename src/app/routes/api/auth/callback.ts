// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { httpError, safeHandler } from '@app/api-utils'
import { clearTempCookie, exchangeCodeForTokens, fetchGoogleUser, parseTempCookie, upsertUserFromGoogle } from '@common/auth/google'
import { hasDatabase, getDb } from '@common/infra/db'
import { session } from '@common/infra/session'
import { orgs, orgMembers } from '@entities/org/db/schema'
import { eq } from 'drizzle-orm'

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
        const redirectTo = tmp.redirectTo || '/dashboard'

        const tokens = await exchangeCodeForTokens(request, code)
        const profile = await fetchGoogleUser(tokens.access_token)
        const { userId } = await upsertUserFromGoogle({ sub: profile.sub, email: profile.email, name: profile.name, picture: profile.picture ?? null })

        let activeOrg: { id: string; plan?: string } | undefined
        if (hasDatabase()) {
          try {
            const db = getDb()
            const membs = (await db.select().from(orgMembers).where(eq(orgMembers.userEmail, profile.email)).limit(25)) as any
            const ids = new Set<string>(membs.map((m: any) => String(m.orgId)))
            const all = (await db.select().from(orgs).limit(50)) as any
            const joined = all.filter((o: any) => ids.has(String(o.id)))
            if (joined.length) activeOrg = { id: joined[0]!.id, plan: joined[0]!.plan }
          } catch {}
        }

        const payload = { user: { email: profile.email, name: profile.name ?? null }, activeOrg }
        const cookie = session.set(payload)
        const headers = new Headers()
        headers.set('Location', redirectTo)
        headers.append('Set-Cookie', cookie)
        headers.append('Set-Cookie', clearTempCookie())
        return new Response(null, { status: 302, headers })
      }),
    },
  },
})
