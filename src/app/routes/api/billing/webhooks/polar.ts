import { createFileRoute } from '@tanstack/react-router'
import { httpError, json } from '@app/api-utils'
import { db } from '@common/infra/db'
import { orgs } from '@entities/org/db/schema'
import { upsertSubscriptionEntitlement } from '@entities/subscription/service'
import { eq } from 'drizzle-orm'

/**
 * Polar webhook handler.
 * Docs: https://docs.polar.sh/api/webhooks
 *
 * Events handled:
 * - subscription.created → set plan, entitlements
 * - subscription.updated → update plan, entitlements
 * - subscription.canceled → downgrade to free
 * - order.paid → detect billing cycle renewal
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

        const orgId = data?.metadata?.referenceId || data?.metadata?.orgId || data?.custom_data?.orgId
        const userIdHint = data?.metadata?.userId || data?.metadata?.user_id || data?.custom_data?.userId

        if (!orgId) {
          console.warn('[Polar Webhook] No orgId in webhook payload, attempting best-effort sync')
        }

        // Route to handler based on event type
        switch (eventType) {
          case 'subscription.created':
          case 'subscription.updated':
          case 'subscription.canceled':
            await persistSubscriptionState(data, { orgId, userId: userIdHint })
            break
          case 'order.paid':
            await handleOrderPaid(orgId, userIdHint, data)
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

type SubscriptionContext = { orgId?: string | null; userId?: string | null }

const ACTIVE_STATUSES = new Set(['active', 'trialing'])

async function persistSubscriptionState(subscription: any, context: SubscriptionContext = {}): Promise<void> {
  const subscriptionId = String(subscription?.id || '')
  if (!subscriptionId) {
    console.warn('[Polar Webhook] Subscription missing id, skipping')
    return
  }

  const status: string = String(subscription?.status || 'unknown')
  const orgId = context.orgId ?? resolveOrgId(subscription)
  const userId = context.userId ?? resolveUserId(subscription)

  if (!userId) {
    console.warn('[Polar Webhook] No userId for subscription', { subscriptionId, status })
    return
  }

  const priceMetadata = mergeMetadata(subscription)
  const seatQuantity = normalizeNumber(subscription?.seats ?? subscription?.seat_quantity)
  const tier = determineTier(subscription, priceMetadata)
  const entitlements = deriveEntitlements(status, priceMetadata, seatQuantity)

  await upsertSubscriptionEntitlement({
    subscriptionId,
    userId,
    orgId,
    status,
    tier,
    productId: subscription?.product_id || subscription?.product?.id || null,
    priceId: subscription?.product_price_id || subscription?.price_id || subscription?.price?.id || null,
    customerId: subscription?.customer_id || subscription?.customer?.id || null,
    seatQuantity,
    currentPeriodEnd: subscription?.current_period_end || subscription?.ends_at || null,
    trialEndsAt: subscription?.trial_end || subscription?.trial_ends_at || null,
    cancelAt: subscription?.cancel_at || subscription?.canceled_at || null,
    cancelAtPeriodEnd: Boolean(subscription?.cancel_at_period_end),
    metadata: priceMetadata,
    entitlements,
    rawPayload: buildRawSnapshot(subscription),
    lastSyncedAt: new Date()
  })

  if (orgId) {
    const plan = ACTIVE_STATUSES.has(status) ? tier || 'paid' : 'starter'
    const activeUntil = subscription?.current_period_end || subscription?.ends_at || null
    const trialEndsAt = subscription?.trial_end || null
    await db
      .update(orgs)
      .set({
        plan,
        entitlementsJson: {
          ...entitlements,
          status,
          activeUntil,
          trialEndsAt,
          seatQuantity
        },
        updatedAt: new Date()
      })
      .where(eq(orgs.id, orgId))

    console.log('[Polar Webhook] Persisted subscription state', {
      subscriptionId,
      orgId,
      userId,
      status,
      plan,
      activeUntil,
      seatQuantity
    })
  } else {
    console.log('[Polar Webhook] Stored entitlement without org binding', {
      subscriptionId,
      userId,
      status,
      seatQuantity
    })
  }
}

async function handleOrderPaid(orgId: string | null | undefined, userIdHint: string | null | undefined, order: any): Promise<void> {
  const subscriptionId = order?.subscription_id
  if (!subscriptionId) {
    console.log('[Polar Webhook] Order has no subscription, skipping')
    return
  }

  const token = process.env.POLAR_ACCESS_TOKEN
  if (!token) {
    console.warn('[Polar Webhook] POLAR_ACCESS_TOKEN missing; cannot refresh subscription', { subscriptionId })
    return
  }

  const server =
    (process.env.POLAR_SERVER || '').toLowerCase() === 'sandbox'
      ? 'https://sandbox-api.polar.sh/v1'
      : 'https://api.polar.sh/v1'

  try {
    const res = await fetch(`${server}/subscriptions/${subscriptionId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })

    if (!res.ok) {
      console.error('[Polar Webhook] Failed to fetch subscription', { subscriptionId, status: res.status })
      return
    }

    const subscription = await res.json()
    await persistSubscriptionState(subscription, { orgId, userId: userIdHint })
  } catch (error) {
    console.error('[Polar Webhook] Error fetching subscription', {
      subscriptionId,
      message: (error as Error)?.message || String(error)
    })
  }
}

function resolveOrgId(subscription: any): string | null {
  return (
    subscription?.metadata?.referenceId ||
    subscription?.metadata?.orgId ||
    subscription?.metadata?.org_id ||
    subscription?.customer?.metadata?.orgId ||
    subscription?.customer?.organization_id ||
    null
  )
}

function resolveUserId(subscription: any): string | null {
  return (
    subscription?.metadata?.userId ||
    subscription?.metadata?.user_id ||
    subscription?.customer?.metadata?.userId ||
    subscription?.customer?.external_id ||
    null
  )
}

function mergeMetadata(subscription: any): Record<string, unknown> {
  const merged: Record<string, unknown> = {}
  const sources = [
    subscription?.price?.metadata,
    subscription?.product_price?.metadata,
    subscription?.product?.metadata,
    subscription?.metadata
  ]
  for (const source of sources) {
    if (source && typeof source === 'object') {
      Object.assign(merged, source as Record<string, unknown>)
    }
  }
  return merged
}

function deriveEntitlements(
  status: string,
  metadata: Record<string, unknown>,
  seatQuantity: number | null | undefined
): Record<string, unknown> {
  const active = ACTIVE_STATUSES.has(status)
  const unitPosts = normalizeNumber(
    metadata.unit_posts ?? metadata.unitPosts ?? metadata.monthly_post_credits ?? metadata.monthlyPostCredits
  )
  const multiplier = normalizeNumber(metadata.multiplier) || 1
  const seats = seatQuantity && seatQuantity > 0 ? seatQuantity : 1

  const monthlyPostCredits = active
    ? Math.max(0, (unitPosts || 30) * Math.max(1, multiplier) * Math.max(1, seats))
    : 0

  const projectQuota = normalizeNumber(metadata.project_quota ?? metadata.projectQuota) || (active ? 100 : 1)

  return {
    monthlyPostCredits,
    projectQuota
  }
}

function determineTier(subscription: any, metadata: Record<string, unknown>): string | null {
  if (typeof metadata?.plan_tier === 'string') return metadata.plan_tier as string
  if (typeof metadata?.planTier === 'string') return metadata.planTier as string
  if (typeof subscription?.product?.name === 'string') return subscription.product.name
  if (typeof subscription?.product_price_id === 'string') return subscription.product_price_id
  if (typeof subscription?.price_id === 'string') return subscription.price_id
  return null
}

function buildRawSnapshot(subscription: any): Record<string, unknown> {
  return {
    id: subscription?.id,
    status: subscription?.status,
    current_period_end: subscription?.current_period_end ?? subscription?.ends_at,
    current_period_start: subscription?.current_period_start,
    trial_end: subscription?.trial_end,
    cancel_at: subscription?.cancel_at,
    cancel_at_period_end: subscription?.cancel_at_period_end,
    customer_id: subscription?.customer_id,
    product_id: subscription?.product_id,
    price_id: subscription?.product_price_id || subscription?.price_id,
    seats: subscription?.seats,
    metadata: subscription?.metadata,
    price_metadata: subscription?.price?.metadata || subscription?.product_price?.metadata,
    customer: subscription?.customer
      ? {
          id: subscription.customer.id,
          external_id: subscription.customer.external_id,
          email: subscription.customer.email
        }
      : null
  }
}

function normalizeNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}
