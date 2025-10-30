// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession } from '@app/api-utils'
import { publishJob, queueEnabled } from '@common/infra/queue'

export const Route = createFileRoute('/api/keyword/refresh')({
  server: {
    handlers: {
      POST: safeHandler(async ({ request }) => {
        await requireSession(request)
        const body = await request.json().catch(() => ({}))
        const canonPhrase = String(body?.phrase || '')
        const language = String(body?.language || 'en')
        const locationCode = Number(body?.locationCode || 2840)
        const what = String(body?.what || 'metrics')
        const force = Boolean(body?.force)
        if (!canonPhrase) return httpError(400, 'Missing phrase')
        if (what === 'serp' || what === 'both') {
          if (queueEnabled()) await publishJob({ type: 'serp', payload: { canonPhrase, language, locationCode, force } })
        }
        if (what === 'metrics' || what === 'both') {
          if (queueEnabled()) await publishJob({ type: 'metrics', payload: { canonPhrase, language, locationCode, force } })
        }
        return json({ queued: true })
      })
    }
  }
})

