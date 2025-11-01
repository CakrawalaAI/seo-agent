// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, safeHandler, requireSession, requireAdmin } from '@app/api-utils'
import { hasDatabase, getDb } from '@common/infra/db'
import { keywords } from '@entities/keyword/db/schema'
import { projects } from '@entities/project/db/schema'
import { ensureCanon } from '@features/keyword/server/ensureCanon'
import { eq, and, isNull } from 'drizzle-orm'

export const Route = createFileRoute('/api/admin/backfill-canon')({
  server: {
    handlers: {
      POST: safeHandler(async ({ request }) => {
        await requireSession(request)
        await requireAdmin(request)
        if (!hasDatabase()) return json({ updated: 0 })
        const db = getDb()
        const url = new URL(request.url)
        const limit = Math.max(1, Math.min(1000, Number(url.searchParams.get('limit') || '500')))
        // Fetch keywords missing canonId
        // @ts-ignore
        const rows = (await db.select().from(keywords).where(and(eq(keywords.canonId, null as any))).limit(limit)) as any
        let updated = 0
        for (const row of rows) {
          try {
            // Load project to get defaultLocale
            // @ts-ignore
            const proj = (await db.select().from(projects).where(eq(projects.id, row.projectId)).limit(1)) as any
            const locale = proj?.[0]?.defaultLocale || 'en-US'
            const canon = await ensureCanon(String(row.phrase || ''), String(locale))
            // @ts-ignore
            await db.update(keywords).set({ canonId: canon.id }).where(eq(keywords.id, row.id))
            updated++
          } catch {}
        }
        return json({ updated })
      })
    }
  }
})
