// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@app/api-utils'
import { hasDatabase, getDb } from '@common/infra/db'
import { orgs, orgMembers } from '@entities/org/db/schema'
import { eq } from 'drizzle-orm'
import { session } from '@common/infra/session'
import { getEntitlements as fetchEntitlements } from '@common/infra/entitlements'

export const Route = createFileRoute('/api/me')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (process.env.E2E_NO_AUTH === '1') {
          const today = new Date().toISOString()
          const devOrg = { id: 'org-dev', name: 'Development Org', plan: 'starter' }
          return json({
            user: { email: 'dev@example.com', name: 'Dev User' },
            activeOrg: { id: devOrg.id, plan: devOrg.plan },
            entitlements: { monthlyPostCredits: 1, projectQuota: 5 },
            usage: { postsUsed: 0, monthlyPostCredits: 1, cycleStart: today },
            orgs: [devOrg]
          })
        }
        const appSess = session.read(request)
        if (!appSess?.user) return json({ user: null, activeOrg: null, entitlements: null, orgs: [] })
        const activeProjectId = appSess?.activeProjectId ?? null
        let activeOrg: { id: string; plan?: string } | null = null
        let entitlements: any = null
        let usage: { postsUsed?: number; monthlyPostCredits?: number; cycleStart?: string | null } | null = null
        let orgList: Array<{ id: string; name: string; plan?: string }> = []
        if (hasDatabase()) {
          try {
            const db = getDb()
            const activeId = appSess?.activeOrg?.id
            // @ts-ignore
            const membs = (await db.select().from(orgMembers).where(eq(orgMembers.userEmail, appSess.user.email)).limit(25)) as any
            const ids = new Set<string>(membs.map((m: any) => String(m.orgId)))
            // @ts-ignore
            const all = (await db.select().from(orgs).limit(50) as any) || []
            if (all.length) orgList = all.map((o: any) => ({ id: o.id, name: o.name, plan: o.plan }))
            const joined = all.filter((o: any) => ids.has(String(o.id)))
            if (activeId) {
              const foundActive = all.find((o: any) => String(o.id) === String(activeId))
              if (foundActive) activeOrg = { id: foundActive.id, plan: foundActive.plan }
            }
            if (!activeOrg && joined.length) activeOrg = { id: joined[0]!.id, plan: joined[0]!.plan }
            if (activeOrg?.id) {
              try {
                entitlements = await fetchEntitlements(activeOrg.id)
              } catch {
                entitlements = { monthlyPostCredits: 1 }
              }
              usage = { postsUsed: 0, monthlyPostCredits: Number(entitlements?.monthlyPostCredits || 0), cycleStart: null }
            }
          } catch {}
        }
        return json({ user: { email: appSess.user.email, name: appSess.user.name }, activeOrg, entitlements, usage, orgs: orgList, activeProjectId })
      }
    }
  }
})
