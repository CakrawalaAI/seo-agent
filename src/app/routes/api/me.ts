// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@app/api-utils'
import { hasDatabase, getDb } from '@common/infra/db'
import { orgs, orgMembers, orgUsage } from '@entities/org/db/schema'
import { eq } from 'drizzle-orm'
import { auth } from '@common/auth/server'

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
        const s = await auth.api.getSession({ headers: request.headers as any })
        if (!s) return json({ user: null, activeOrg: null, entitlements: null, orgs: [] })
        let activeOrg: { id: string; plan?: string } | null = null
        let entitlements: any = null
        let usage: { postsUsed?: number; monthlyPostCredits?: number; cycleStart?: string | null } | null = null
        let orgList: Array<{ id: string; name: string; plan?: string }> = []
        if (hasDatabase()) {
          try {
            const db = getDb()
            // attempt to use Better Auth activeOrganizationId first
            const activeId = (s as any)?.session?.activeOrganizationId as string | undefined
            // @ts-ignore
            const membs = (await db.select().from(orgMembers).where(eq(orgMembers.userEmail, s.user.email)).limit(25)) as any
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
              const found = all.find((o: any) => String(o.id) === activeOrg!.id)
              if (found) {
                entitlements = found.entitlementsJson ?? null
                // Seed free trial if no entitlements exist
                if (!entitlements) {
                  const trialEnt = { monthlyPostCredits: 1 }
                  try {
                    await db
                      .insert(orgs)
                      .values({ id: activeOrg.id, name: activeOrg.id, plan: found.plan ?? 'starter', entitlementsJson: trialEnt as any })
                      .onConflictDoUpdate({ target: orgs.id, set: { entitlementsJson: trialEnt as any, updatedAt: new Date() as any } })
                  } catch {}
                  entitlements = trialEnt
                }
                // Ensure org_usage row exists
                try {
                  await db
                    .insert(orgUsage)
                    .values({ orgId: activeOrg.id, postsUsed: 0 })
                    .onConflictDoNothing?.()
                } catch {}
                // Read usage row
                try {
                  // @ts-ignore
                  const u = await (db.select().from(orgUsage).where((orgUsage as any).orgId.eq(activeOrg.id)).limit(1) as any)
                  const row = u?.[0]
                  if (row) usage = { postsUsed: Number(row.postsUsed || 0), cycleStart: row.cycleStart ? new Date(row.cycleStart).toISOString() : null, monthlyPostCredits: Number(entitlements?.monthlyPostCredits || 0) }
                } catch {}
              }
            }
          } catch {}
        }
        return json({ user: { email: s.user.email, name: s.user.name }, activeOrg, entitlements, usage, orgs: orgList })
      }
    }
  }
})
