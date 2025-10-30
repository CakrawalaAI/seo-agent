import { db } from './db'
import { orgs, orgUsage } from '@entities/org/db/schema'
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
 * Usage data from org_usage table.
 */
export type Usage = {
  postsUsed: number
  cycleStart: Date | null
}

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

  // Fetch usage
  const usageRows = await db.select().from(orgUsage).where(eq(orgUsage.orgId, orgId)).limit(1)

  let usage: Usage = { postsUsed: 0, cycleStart: null }
  if (usageRows.length > 0) {
    usage = {
      postsUsed: usageRows[0].postsUsed,
      cycleStart: usageRows[0].cycleStart
    }
  } else {
    // Create usage row if doesn't exist
    await db.insert(orgUsage).values({
      orgId,
      cycleStart: new Date(),
      postsUsed: 0,
      updatedAt: new Date()
    })
  }

  const monthlyPostCredits = entitlements.monthlyPostCredits ?? 1
  const remaining = monthlyPostCredits - usage.postsUsed

  if (usage.postsUsed >= monthlyPostCredits) {
    return {
      allowed: false,
      reason: `Monthly post limit reached (${usage.postsUsed}/${monthlyPostCredits})`,
      entitlements,
      usage,
      remaining: 0
    }
  }

  return {
    allowed: true,
    entitlements,
    usage,
    remaining
  }
}

/**
 * Increment post usage for an organization.
 * Should be called after successful article generation or publishing.
 *
 * @param orgId - Organization ID
 * @returns New usage count
 */
export async function incrementPostUsage(orgId: string): Promise<number> {
  const usageRows = await db.select().from(orgUsage).where(eq(orgUsage.orgId, orgId)).limit(1)

  if (usageRows.length === 0) {
    // Create usage row
    await db.insert(orgUsage).values({
      orgId,
      cycleStart: new Date(),
      postsUsed: 1,
      updatedAt: new Date()
    })
    return 1
  }

  const newUsage = usageRows[0].postsUsed + 1

  await db
    .update(orgUsage)
    .set({
      postsUsed: newUsage,
      updatedAt: new Date()
    })
    .where(eq(orgUsage.orgId, orgId))

  return newUsage
}

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
export async function getUsage(orgId: string): Promise<Usage> {
  const usageRows = await db.select().from(orgUsage).where(eq(orgUsage.orgId, orgId)).limit(1)

  if (usageRows.length === 0) {
    return { postsUsed: 0, cycleStart: null }
  }

  return {
    postsUsed: usageRows[0].postsUsed,
    cycleStart: usageRows[0].cycleStart
  }
}
