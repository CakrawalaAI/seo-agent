import { db } from './db'
import { orgs } from '@entities/org/db/schema'
import { getSubscriptionEntitlementByOrg } from '@entities/subscription/service'
import { eq } from 'drizzle-orm'

/**
 * Entitlements from org.entitlementsJson.
 */
export type Entitlements = {
  monthlyPostCredits: number | null
  projectQuota?: number | null
  status?: string | null
  activeUntil?: string | null
  trialEndsAt?: string | null
  seatQuantity?: number | null
  [key: string]: unknown
}

/**
 * Usage data not persisted (org_usage removed).
 */
export type Usage = { postsUsed: number; cycleStart: Date | null }

/**
 * Combined entitlements and usage check result.
 */
export type EntitlementCheck = {
  allowed: boolean
  reason?: string
  entitlements: Entitlements
  usage: Usage
  remaining: number
}

/**
 * Check if an organization has remaining post credits.
 * Returns entitlement check result with allowed flag.
 *
 * @param orgId - Organization ID
 * @returns EntitlementCheck object
 */
export async function checkPostEntitlement(orgId: string): Promise<EntitlementCheck> {
  const subscription = await getSubscriptionEntitlementByOrg(orgId)
  const usage: Usage = { postsUsed: 0, cycleStart: null }

  if (subscription) {
    const entitlements = normalizeEntitlements(
      subscription.entitlements,
      subscription.status,
      subscription.currentPeriodEnd ?? null,
      subscription.trialEndsAt ?? null,
      subscription.seatQuantity ?? null
    )

    const allowed = isActiveStatus(subscription.status)
    const remaining = computeRemaining(entitlements, usage)
    const reason = allowed ? undefined : `Subscription ${subscription.status || 'inactive'}`

    return {
      allowed,
      reason,
      entitlements,
      usage,
      remaining
    }
  }

  const legacy = await readOrgEntitlements(orgId)
  if (!legacy) {
    return {
      allowed: false,
      reason: 'Organization not found',
      entitlements: { monthlyPostCredits: 0 },
      usage,
      remaining: 0
    }
  }

  const remaining = typeof legacy.monthlyPostCredits === 'number' ? legacy.monthlyPostCredits : 0
  return { allowed: true, entitlements: legacy, usage, remaining }
}

/**
 * Increment post usage for an organization.
 * Should be called after successful article generation or publishing.
 *
 * @param orgId - Organization ID
 * @returns New usage count
 */
export async function incrementPostUsage(_orgId: string): Promise<number> { return 0 }

/**
 * Middleware helper: Require post entitlement for the request.
 * Returns 429 Too Many Requests if quota exceeded.
 *
 * Usage in API routes:
 * ```ts
 * const check = await requirePostEntitlement(sess.activeOrg.id)
 * if (!check.allowed) {
 *   return httpError(429, check.reason || 'Quota exceeded')
 * }
 * ```
 */
export async function requirePostEntitlement(orgId: string): Promise<EntitlementCheck> {
  return await checkPostEntitlement(orgId)
}

/**
 * Get entitlements for an organization (for display purposes).
 */
export async function getEntitlements(orgId: string): Promise<Entitlements | null> {
  const subscription = await getSubscriptionEntitlementByOrg(orgId)
  if (subscription) {
    return normalizeEntitlements(
      subscription.entitlements,
      subscription.status,
      subscription.currentPeriodEnd ?? null,
      subscription.trialEndsAt ?? null,
      subscription.seatQuantity ?? null
    )
  }

  const legacy = await readOrgEntitlements(orgId)
  return legacy ?? { monthlyPostCredits: 1 }
}

/**
 * Get usage for an organization (for display purposes).
 */
export async function getUsage(_orgId: string): Promise<Usage> { return { postsUsed: 0, cycleStart: null } }

function isActiveStatus(status: string | undefined | null): boolean {
  if (!status) return false
  const normalized = String(status).toLowerCase()
  return normalized === 'active' || normalized === 'trialing'
}

function normalizeEntitlements(
  ent: Record<string, unknown> | null | undefined,
  status: string | undefined | null,
  activeUntil: string | null,
  trialEndsAt: string | null,
  seatQuantity: number | null
): Entitlements {
  const monthly =
    normalizeNumber((ent as any)?.monthlyPostCredits ?? (ent as any)?.monthly_post_credits) ??
    (isActiveStatus(status) ? 30 : 0)
  const projectQuota =
    normalizeNumber((ent as any)?.projectQuota ?? (ent as any)?.project_quota) ??
    (isActiveStatus(status) ? 100 : 1)

  return {
    ...(ent || {}),
    monthlyPostCredits: monthly,
    projectQuota,
    status: status ?? null,
    activeUntil,
    trialEndsAt,
    seatQuantity
  }
}

async function readOrgEntitlements(orgId: string): Promise<Entitlements | null> {
  const rows = await db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1)
  if (rows.length === 0) return null
  const ent = rows[0].entitlementsJson as Entitlements | null
  return ent ?? { monthlyPostCredits: 1 }
}

function computeRemaining(entitlements: Entitlements, usage: Usage): number {
  const monthly = typeof entitlements.monthlyPostCredits === 'number' ? entitlements.monthlyPostCredits : 0
  if (monthly <= 0) return 0
  return Math.max(0, monthly - usage.postsUsed)
}

function normalizeNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}
