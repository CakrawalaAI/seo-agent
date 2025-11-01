// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, safeHandler, requireSession, requireAdmin } from '@app/api-utils'
import { hasDatabase, getDb } from '@common/infra/db'
import { keywords } from '@entities/keyword/db/schema'
import { keywordCanon } from '@entities/keyword/db/schema.canon'
import { publishJob, queueEnabled } from '@common/infra/queue'

export const Route = createFileRoute('/api/schedules/serp-monthly')({
  server: {
    handlers: {
      POST: safeHandler(async ({ request }) => {
        await requireSession(request)
        await requireAdmin(request)
        if (!hasDatabase()) return json({ queued: 0 })
        const db = getDb()
        // Collect in-use canons
        // @ts-ignore
        const rows = (await db.select().from(keywords).where((keywords as any).canonId.isNotNull()).limit(5000)) as any
        const canonIds = Array.from(new Set(rows.map((r: any) => r.canonId).filter(Boolean)))
        const canons: any[] = []
        for (const id of canonIds) {
          try {
            // @ts-ignore
            const crow = (await db.select().from(keywordCanon).where((keywordCanon as any).id.eq(id)).limit(1)) as any
            const c = crow?.[0]
            if (c) canons.push(c)
          } catch {}
        }
        let queued = 0
        if (queueEnabled()) {
          for (const c of canons) {
            await publishJob({ type: 'serp', payload: { canonPhrase: c.phraseNorm, language: c.languageCode, locationCode: 2840, device: 'desktop', topK: 10, anchorMonthly: true } })
            queued++
          }
        }
        return json({ queued })
      })
    }
  }
})
