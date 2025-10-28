// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { requireSession, httpError } from '@app/api-utils'

export const Route = createFileRoute('/api/billing/portal')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const sess = await requireSession(request)
        // optional return url
        const body = await request.json().catch(() => ({}))
        const baseUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3000'
        const returnUrl = String(body?.returnUrl || `${baseUrl}/dashboard`)

        const token = process.env.POLAR_ACCESS_TOKEN || ''
        if (!token) return httpError(500, 'Server missing POLAR_ACCESS_TOKEN')
        const server = (process.env.POLAR_SERVER || '').toLowerCase() === 'sandbox' ? 'https://sandbox-api.polar.sh/v1' : 'https://api.polar.sh/v1'

        const customerId = process.env.POLAR_CUSTOMER_ID || ''
        const orgSlug = process.env.POLAR_ORG_SLUG || ''

        if (customerId) {
          const res = await fetch(`${server}/billing_portal/sessions`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ customer_id: customerId, return_url: returnUrl })
          })
          if (!res.ok) return httpError(res.status, 'Portal creation failed')
          const data = (await res.json().catch(() => ({}))) as any
          const url = data?.url || data?.data?.url
          if (!url) return httpError(500, 'Portal URL missing')
          return new Response(JSON.stringify({ url }), { status: 200, headers: { 'content-type': 'application/json' } })
        }

        if (orgSlug) {
          const url = `https://polar.sh/${orgSlug}/portal`
          return new Response(JSON.stringify({ url }), { status: 200, headers: { 'content-type': 'application/json' } })
        }

        return httpError(400, 'Portal unavailable: set POLAR_CUSTOMER_ID or POLAR_ORG_SLUG')
      }
    }
  }
})

