// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { httpError, json, safeHandler } from '@app/api-utils'
import { createCheckoutSession } from '@common/billing/polar'

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
        // Try Polar when configured; graceful fallback to mock
        const polar = await createCheckoutSession({ orgId: String(orgId), plan: String(plan), successUrl, cancelUrl })
        if (polar?.url) return json({ url: polar.url, cancelUrl })
        const url = `${successUrl}${successUrl.includes('?') ? '&' : '?'}plan=${encodeURIComponent(plan)}&session=mock`
        return json({ url, cancelUrl })
      })
    }
  }
})
