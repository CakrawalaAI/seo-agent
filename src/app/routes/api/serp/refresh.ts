// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession } from '@app/api-utils'
import { publishJob, queueEnabled } from '@common/infra/queue'

export const Route = createFileRoute('/api/serp/refresh')({
  server: {
    handlers: {
      POST: safeHandler(async ({ request }) => {
        await requireSession(request)
        const body = await request.json().catch(() => ({}))
        const canonPhrase = String(body?.phrase || '')
        const language = String(body?.language || 'en')
        const locationCode = Number(body?.locationCode || 2840)
        const device = body?.device === 'mobile' ? 'mobile' : 'desktop'
        const topK = Number(body?.topK || 10)
        const force = Boolean(body?.force)
        if (!canonPhrase) return httpError(400, 'Missing phrase')
        if (queueEnabled()) await publishJob({ type: 'serp', payload: { canonPhrase, language, locationCode, device, topK, force } })
        return json({ queued: true })
      })
    }
  }
})

