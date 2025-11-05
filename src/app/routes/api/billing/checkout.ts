// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { requireSession, httpError } from '@app/api-utils'
import { getEntitlements } from '@common/infra/entitlements'
import { getSubscriptionEntitlementByOrg } from '@entities/subscription/service'

export const Route = createFileRoute('/api/billing/checkout')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const sess = await requireSession(request)
        const activeOrgId = sess.activeOrg?.id
        if (!activeOrgId) return httpError(403, 'Organization not selected')
        const body = await request.json().catch(() => ({}))

        let priceId: string | null = null
        try {
          const ent = await getEntitlements(activeOrgId)
          const subscription = await getSubscriptionEntitlementByOrg(activeOrgId)
          const trialEligible = Boolean(ent?.trial?.eligible ?? true)
          const hasSubscriptionHistory = Boolean(subscription)
          const useTrialPrice = trialEligible && !hasSubscriptionHistory
          const trialPrice = String(body?.trialPriceId || process.env.POLAR_PRICE_POSTS_TRIAL || '')
          const standardPrice = String(body?.priceId || process.env.POLAR_PRICE_POSTS_STANDARD || process.env.POLAR_PRICE_POSTS_30 || '')
          priceId = useTrialPrice ? trialPrice : standardPrice
          if (!priceId) {
            const missingKey = useTrialPrice ? 'POLAR_PRICE_POSTS_TRIAL' : 'POLAR_PRICE_POSTS_STANDARD'
            return httpError(400, `Missing ${missingKey}`)
          }
        } catch (error) {
          return httpError(500, (error as Error)?.message || 'Checkout eligibility failure')
        }

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
