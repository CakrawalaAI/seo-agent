// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { session } from '@common/infra/session'
import { json } from '@app/api-utils'
import { hasDatabase, getDb } from '@common/infra/db'
import { orgs } from '@entities/org/db/schema'
import { eq } from 'drizzle-orm'

export const Route = createFileRoute('/api/me')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const sess = session.read(request)
        if (!sess) return json({ user: null, activeOrg: null, entitlements: null, orgs: [] })
        let activeOrg = sess.activeOrg ?? null
        let entitlements = sess.entitlements ?? null
        let orgList = sess.orgs ?? []
        if (hasDatabase()) {
          try {
            const db = getDb()
            if (activeOrg?.id) {
              // @ts-ignore
              const rows = await (db.select().from(orgs).where(eq(orgs.id, activeOrg.id)).limit(1) as any)
              if (rows[0]) {
                activeOrg = { id: rows[0].id, plan: rows[0].plan }
                entitlements = (rows[0].entitlementsJson as any) ?? entitlements
              }
            }
            // list known orgs
            // @ts-ignore
            const all = (await db.select().from(orgs).limit(50) as any) || []
            if (all.length) orgList = all.map((o: any) => ({ id: o.id, name: o.name, plan: o.plan }))
          } catch {}
        }
        return json({ user: sess.user, activeOrg, entitlements, orgs: orgList })
      }
    }
  }
})
