// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { session } from '@common/infra/session'
import { googleEnabled, exchangeGoogleCode } from '@common/auth/better-auth'
import { hasDatabase, getDb } from '@common/infra/db'
import { orgs, orgMembers } from '@entities/org/db/schema'
import { eq } from 'drizzle-orm'
import { json } from '@app/api-utils'

// Dev-friendly Google callback shim.
// If BETTER_AUTH_ENABLE=1 and you are using an external OAuth app that redirects back
// with ?email=..., this will set the session cookie. In production, replace with better-auth handler.
export const Route = createFileRoute('/api/auth/callback/google')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const next = url.searchParams.get('next') || '/dashboard'
        const code = url.searchParams.get('code')
        let email = url.searchParams.get('email') || ''
        let name: string | undefined
        if (code && googleEnabled()) {
          const profile = await exchangeGoogleCode(code)
          email = profile?.email || email
          name = profile?.name || undefined
        }
        if (!email) {
          // dev fallback
          email = 'user@example.com'
        }
        // pick active org by membership if exists
        let activeOrg = { id: 'org-dev', plan: 'starter' }
        let orgList = [{ id: 'org-dev', name: 'Dev Org', plan: 'starter' }]
        if (hasDatabase()) {
          try {
            const db = getDb()
            // @ts-ignore
            const membs = (await db.select().from(orgMembers).where(eq(orgMembers.userEmail, email)).limit(25)) as any
            const ids = new Set<string>(membs.map((m: any) => String(m.orgId)))
            if (ids.size) {
              // @ts-ignore
              const rows = (await db.select().from(orgs).limit(100)) as any
              const joined = rows.filter((o: any) => ids.has(String(o.id)))
              if (joined.length) {
                orgList = joined.map((o: any) => ({ id: o.id, name: o.name, plan: o.plan }))
                activeOrg = { id: orgList[0]!.id, plan: orgList[0]!.plan }
              }
            }
          } catch {}
        }
        const cookie = session.set({
          user: { email, name: name ?? null },
          orgs: orgList,
          activeOrg,
          entitlements: { projectQuota: 3, dailyArticles: 1 }
        })
        return new Response(null, { status: 302, headers: { Location: next, 'Set-Cookie': cookie } })
      }
    }
  }
})
