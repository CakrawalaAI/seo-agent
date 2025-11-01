// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession, requireAdmin } from '@app/api-utils'
import { hasDatabase, getDb } from '@common/infra/db'
import { keywordCanon } from '@entities/keyword/db/schema.canon'
import { eq } from 'drizzle-orm'
import { publishJob, queueEnabled } from '@common/infra/queue'
import { z } from 'zod'
import { parseJson } from '@common/http/validate'

export const Route = createFileRoute('/api/serp/refresh')({
  server: {
    handlers: {
      POST: safeHandler(async ({ request }) => {
        await requireSession(request)
        await requireAdmin(request)
        const body = await parseJson(request, z.object({
          canonId: z.string().min(1).optional(),
          phrase: z.string().min(1).optional(),
          language: z.string().default('en-US').optional(),
          locationCode: z.number().int().positive().default(2840).optional(),
          device: z.enum(['desktop', 'mobile']).default('desktop').optional(),
          topK: z.number().int().min(1).max(50).default(10).optional(),
          force: z.boolean().optional()
        }))
        let canonPhrase = body.phrase as string | undefined
        let language = (body.language || 'en-US') as string
        const locationCode = Number(body.locationCode || 2840)
        const device = (body.device || 'desktop') as 'desktop' | 'mobile'
        const topK = Number(body.topK || 10)
        const force = Boolean(body.force)
        if (body.canonId && hasDatabase()) {
          try {
            const db = getDb()
            const rows = await db.select().from(keywordCanon).where(eq(keywordCanon.id, body.canonId!)).limit(1)
            const row: any = rows?.[0]
            if (row) { canonPhrase = row.phraseNorm; language = row.languageCode || language }
          } catch {}
        }
        if (!canonPhrase) return httpError(400, 'Missing canonId or phrase')
        if (queueEnabled()) await publishJob({ type: 'serp', payload: { canonPhrase, language, locationCode, device, topK, force } })
        return json({ queued: true })
      })
    }
  }
})
