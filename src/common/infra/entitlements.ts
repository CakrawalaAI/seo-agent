import { db } from './db'
import { orgs } from '@entities/org/db/schema'
import { eq } from 'drizzle-orm'

/**
 * Entitlements from org.entitlementsJson.
 */
export type Entitlements = {
  monthlyPostCredits: number
  projectQuota?: number
  status?: string
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
  // Fetch org entitlements
  const orgRows = await db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1)

  if (orgRows.length === 0) {
    return {
      allowed: false,
      reason: 'Organization not found',
      entitlements: { monthlyPostCredits: 0 },
      usage: { postsUsed: 0, cycleStart: null },
      remaining: 0
    }
  }

  const org = orgRows[0]
  const entitlements = (org.entitlementsJson as Entitlements) ?? { monthlyPostCredits: 1 }

  // Usage gating removed: always allow; return zero usage
  const usage: Usage = { postsUsed: 0, cycleStart: null }
  const remaining = entitlements.monthlyPostCredits ?? Infinity
  return { allowed: true, entitlements, usage, remaining }
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
  const orgRows = await db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1)

  if (orgRows.length === 0) return null

  return (orgRows[0].entitlementsJson as Entitlements) ?? { monthlyPostCredits: 1 }
}

/**
 * Get usage for an organization (for display purposes).
 */
export async function getUsage(_orgId: string): Promise<Usage> { return { postsUsed: 0, cycleStart: null } }
