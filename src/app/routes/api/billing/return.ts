// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { session } from '@common/infra/session'
import { hasDatabase, getDb } from '@common/infra/db'
import { orgs } from '@entities/org/db/schema'
import { eq } from 'drizzle-orm'

export const Route = createFileRoute('/api/billing/return')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const next = url.searchParams.get('next') || '/dashboard?billing=success'
        const orgId = url.searchParams.get('orgId') || 'org-dev'
        let plan = 'starter'
        let entitlements = { projectQuota: 3, dailyArticles: 1 }
        if (hasDatabase()) {
          try {
            const db = getDb()
            // @ts-ignore
            const rows = await (db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1) as any)
            const row = rows?.[0]
            if (row) {
              plan = row.plan || plan
              entitlements = (row.entitlementsJson as any) || entitlements
            }
          } catch {}
        }
        const current = session.read(request) || { user: null }
        const cookie = session.set({
          ...current,
          activeOrg: { id: orgId, plan },
          entitlements
        })
        return new Response(null, { status: 302, headers: { Location: next, 'Set-Cookie': cookie } })
      }
    }
  }
})

