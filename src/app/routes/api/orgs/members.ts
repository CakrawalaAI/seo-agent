// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { safeHandler, json, requireSession } from '@app/api-utils'
import { hasDatabase, getDb } from '@common/infra/db'
import { orgMembers } from '@entities/org/db/schema'
import { eq } from 'drizzle-orm'
import { log } from '@src/common/logger'

export const Route = createFileRoute('/api/orgs/members')({
  server: {
    handlers: {
      GET: safeHandler(async ({ request }) => {
        const sess = await requireSession(request)
        const orgId = sess.activeOrg?.id
        if (!orgId) return json({ items: [] })
        if (hasDatabase()) {
          try {
            const db = getDb()
            const rows = await db.select().from(orgMembers).where(eq(orgMembers.orgId, orgId)).limit(200)
            const items = rows.map((row: any) => ({
              orgId: String(row.orgId),
              email: String(row.userEmail),
              role: String(row.role ?? 'member'),
              joinedAt: row.createdAt ? new Date(row.createdAt as any).toISOString() : null
            }))
            return json({ items })
          } catch (error) {
            log.error('Fetch org members failed', error)
          }
        }
        return json({ items: [] })
      })
    }
  }
})
