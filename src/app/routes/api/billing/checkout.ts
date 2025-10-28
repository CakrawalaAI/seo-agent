// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { requireSession, httpError } from '@app/api-utils'

export const Route = createFileRoute('/api/billing/checkout')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const sess = await requireSession(request)
        const activeOrgId = sess.activeOrg?.id
        if (!activeOrgId) return httpError(403, 'Organization not selected')
        const body = await request.json().catch(() => ({}))
        const priceId = String(body?.priceId || process.env.POLAR_PRICE_POSTS_30 || '')
        if (!priceId) return httpError(400, 'Missing POLAR_PRICE_POSTS_30')

        const token = process.env.POLAR_ACCESS_TOKEN || ''
        if (!token) return httpError(500, 'Server missing POLAR_ACCESS_TOKEN')
        const server = (process.env.POLAR_SERVER || '').toLowerCase() === 'sandbox' ? 'https://sandbox-api.polar.sh/v1' : 'https://api.polar.sh/v1'

        const res = await fetch(`${server}/checkouts`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ product_price_id: priceId, metadata: { referenceId: activeOrgId } })
        })
        if (!res.ok) return httpError(res.status, 'Checkout creation failed')
        const data = (await res.json().catch(() => ({}))) as any
        const url = data?.url || data?.data?.url
        if (!url) return httpError(500, 'Checkout URL missing')
        return new Response(null, { status: 302, headers: { Location: url } })
      }
    }
  }
})
