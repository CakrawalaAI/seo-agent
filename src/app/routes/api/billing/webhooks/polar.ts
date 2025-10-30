import { createFileRoute } from '@tanstack/react-router'
import { httpError, json } from '@app/api-utils'
import { db } from '@common/infra/db'
import { orgs, orgUsage } from '@entities/org/db/schema'
import { eq } from 'drizzle-orm'

/**
 * Polar webhook handler.
 * Docs: https://docs.polar.sh/api/webhooks
 *
 * Events handled:
 * - subscription.created → set plan, entitlements
 * - subscription.updated → update plan, entitlements
 * - subscription.canceled → downgrade to free
 * - order.paid → detect billing cycle renewal, reset usage
 */
export const Route = createFileRoute('/api/billing/webhooks/polar')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.POLAR_WEBHOOK_SECRET
        if (!secret) {
          console.error('[Polar Webhook] POLAR_WEBHOOK_SECRET not configured')
          return httpError(500, 'Server configuration error')
        }

        // Verify signature
        const signature = request.headers.get('x-polar-signature')
        const body = await request.text()

        if (!verifyWebhookSignature(body, signature, secret)) {
          console.error('[Polar Webhook] Invalid signature')
          return httpError(401, 'Invalid signature')
        }

        // Parse event
        let event: any
        try {
          event = JSON.parse(body)
        } catch {
          return httpError(400, 'Invalid JSON')
        }

        const eventType = event.type
        const data = event.data

        console.log('[Polar Webhook] Received event:', eventType, {
          subscriptionId: data?.id,
          customData: data?.metadata || data?.custom_data
        })

        // Extract orgId from metadata.referenceId or custom_data
        const orgId = data?.metadata?.referenceId || data?.custom_data?.orgId

        if (!orgId) {
          console.warn('[Polar Webhook] No orgId in webhook payload, skipping')
          return json({ received: true })
        }

        // Route to handler based on event type
        switch (eventType) {
          case 'subscription.created':
          case 'subscription.updated':
            await handleSubscriptionUpdate(orgId, data)
            break

          case 'subscription.canceled':
            await handleSubscriptionCanceled(orgId)
            break

          case 'order.paid':
            await handleOrderPaid(orgId, data)
            break

          default:
            console.log('[Polar Webhook] Unhandled event type:', eventType)
        }

        return json({ received: true })
      }
    }
  }
})

/**
 * Verify Polar webhook signature using HMAC-SHA256.
 */
function verifyWebhookSignature(body: string, signature: string | null, secret: string): boolean {
  if (!signature) return false

  try {
    const crypto = require('node:crypto') as typeof import('node:crypto')
    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(body)
    const expectedSignature = hmac.digest('hex')

    // Polar may prefix with "sha256=" or just send the hex
    const receivedSignature = signature.replace(/^sha256=/, '')
    return crypto.timingSafeEqual(Buffer.from(receivedSignature), Buffer.from(expectedSignature))
  } catch (error) {
    console.error('[Polar Webhook] Signature verification error:', error)
    return false
  }
}

/**
 * Handle subscription.created or subscription.updated.
 * Updates org plan and entitlements based on subscription status.
 */
async function handleSubscriptionUpdate(orgId: string, subscription: any): Promise<void> {
  const status = subscription.status // "active" | "canceled" | "past_due" | etc.
  const priceId = subscription.product_price_id || subscription.price_id
  const currentPeriodStart = subscription.current_period_start
  const metadata = subscription.metadata || subscription.price?.metadata || {}

  // Determine plan and credits
  let plan = 'starter'
  let monthlyPostCredits = 1 // Free tier default

  if (status === 'active') {
    // Extract credits from price metadata
    const unitPosts = Number(metadata.unit_posts || metadata.multiplier || 30)
    monthlyPostCredits = unitPosts > 0 ? unitPosts : 30
    plan = priceId || 'paid'
  }

  // Update org
  await db
    .update(orgs)
    .set({
      plan,
      entitlementsJson: {
        monthlyPostCredits,
        projectQuota: 100, // Unlimited in practice
        status
      },
      updatedAt: new Date()
    })
    .where(eq(orgs.id, orgId))

  // Reset usage if billing cycle changed
  const existingUsage = await db.select().from(orgUsage).where(eq(orgUsage.orgId, orgId)).limit(1)

  if (existingUsage.length === 0) {
    // Create usage row
    await db.insert(orgUsage).values({
      orgId,
      cycleStart: currentPeriodStart ? new Date(currentPeriodStart) : new Date(),
      postsUsed: 0,
      updatedAt: new Date()
    })
  } else {
    const lastCycleStart = existingUsage[0].cycleStart

    // If period changed, reset usage
    if (currentPeriodStart && lastCycleStart) {
      const newCycleDate = new Date(currentPeriodStart)
      if (newCycleDate > lastCycleStart) {
        await db
          .update(orgUsage)
          .set({
            cycleStart: newCycleDate,
            postsUsed: 0,
            updatedAt: new Date()
          })
          .where(eq(orgUsage.orgId, orgId))
      }
    }
  }

  console.log('[Polar Webhook] Updated org entitlements:', {
    orgId,
    plan,
    monthlyPostCredits,
    status
  })
}

/**
 * Handle subscription.canceled.
 * Downgrades org to free tier.
 */
async function handleSubscriptionCanceled(orgId: string): Promise<void> {
  await db
    .update(orgs)
    .set({
      plan: 'starter',
      entitlementsJson: {
        monthlyPostCredits: 1,
        projectQuota: 1,
        status: 'canceled'
      },
      updatedAt: new Date()
    })
    .where(eq(orgs.id, orgId))

  console.log('[Polar Webhook] Downgraded org to free tier:', orgId)
}

/**
 * Handle order.paid (renewal or one-time purchase).
 * Resets usage if billing cycle changed.
 */
async function handleOrderPaid(orgId: string, order: any): Promise<void> {
  const subscriptionId = order.subscription_id

  if (!subscriptionId) {
    console.log('[Polar Webhook] Order has no subscription, skipping usage reset')
    return
  }

  // Fetch subscription to get current_period_start
  const token = process.env.POLAR_ACCESS_TOKEN
  if (!token) return

  const server =
    (process.env.POLAR_SERVER || '').toLowerCase() === 'sandbox'
      ? 'https://sandbox-api.polar.sh/v1'
      : 'https://api.polar.sh/v1'

  try {
    const res = await fetch(`${server}/subscriptions/${subscriptionId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })

    if (!res.ok) {
      console.error('[Polar Webhook] Failed to fetch subscription:', res.status)
      return
    }

    const subscription = await res.json()
    await handleSubscriptionUpdate(orgId, subscription)
  } catch (error) {
    console.error('[Polar Webhook] Error fetching subscription:', error)
  }
}
