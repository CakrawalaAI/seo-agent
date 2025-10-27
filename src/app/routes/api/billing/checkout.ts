// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { httpError, json, safeHandler } from '../utils'

export const Route = createFileRoute('/api/billing/checkout')({
  server: {
    handlers: {
      POST: safeHandler(async ({ request }) => {
        const body = await request.json().catch(() => ({}))
        const orgId = body?.orgId
        const plan = body?.plan ?? 'growth'
        const successUrl = typeof body?.successUrl === 'string' ? body.successUrl : '/dashboard?billing=success'
        const cancelUrl = typeof body?.cancelUrl === 'string' ? body.cancelUrl : '/dashboard?billing=cancel'
        if (!orgId) return httpError(400, 'Missing orgId')
        const url = `${successUrl}${successUrl.includes('?') ? '&' : '?'}plan=${encodeURIComponent(plan)}&session=mock`
        // In a real integration we'd create a checkout session and return its URL
        return json({ url, cancelUrl })
      })
    }
  }
})

