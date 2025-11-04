import { and, eq } from 'drizzle-orm'
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'

import { db } from '@common/infra/db'
import { getRedis, redisEnabled } from '@common/infra/redis'
import { log } from '@src/common/logger'

import { subscriptions } from './db/schema'
import type { EntitlementCacheValue, SubscriptionEntitlement } from './domain/entitlement'

type SubscriptionEntitlementRow = InferSelectModel<typeof subscriptions>
type SubscriptionEntitlementInsert = InferInsertModel<typeof subscriptions>

const DEFAULT_CACHE_TTL_SECONDS = Math.max(900, Number(process.env.ENTITLEMENT_CACHE_TTL_SECONDS || '3600'))
const CACHE_PREFIX = 'entitlement:user:'
const SUB_CACHE_VERSION = 'v1'

function cacheKey(userId: string) {
  return `${CACHE_PREFIX}${SUB_CACHE_VERSION}:${userId}`
}

function toIso(date: Date | string | null | undefined): string | null {
  if (!date) return null
  if (typeof date === 'string') return date
  return date.toISOString()
}

function rowToDomain(row: SubscriptionEntitlementRow): SubscriptionEntitlement {
  return {
    subscriptionId: row.polarSubscriptionId,
    userId: row.userId,
    orgId: row.orgId,
    status: row.status as SubscriptionEntitlement['status'],
    tier: row.tier,
    productId: row.productId,
    priceId: row.priceId,
    customerId: row.customerId,
    seatQuantity: row.seatQuantity ?? undefined,
    currentPeriodEnd: toIso(row.currentPeriodEnd),
    trialEndsAt: toIso(row.trialEndsAt),
    cancelAt: toIso(row.cancelAt),
    cancelAtPeriodEnd: row.cancelAtPeriodEnd ?? undefined,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    entitlements: (row.entitlementsJson as Record<string, unknown> | null) ?? null,
    lastSyncedAt: toIso(row.lastSyncedAt),
    updatedAt: toIso(row.updatedAt)
  }
}

function computeCacheValue(row: SubscriptionEntitlementRow): EntitlementCacheValue {
  return {
    subscriptionId: row.polarSubscriptionId,
    status: row.status as SubscriptionEntitlement['status'],
    activeUntil: toIso(row.currentPeriodEnd),
    tier: row.tier,
    trialEndsAt: toIso(row.trialEndsAt),
    seatQuantity: row.seatQuantity ?? undefined,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    entitlements: (row.entitlementsJson as Record<string, unknown> | null) ?? null,
    refreshedAt: new Date().toISOString()
  }
}

async function writeCache(row: SubscriptionEntitlementRow, ttlSeconds?: number) {
  if (!redisEnabled()) return
  const client = getRedis()
  try {
    await client.set(cacheKey(row.userId), JSON.stringify(computeCacheValue(row)), 'EX', ttlSeconds ?? DEFAULT_CACHE_TTL_SECONDS)
  } catch (error) {
    log.error('[entitlements] cache write failed', { message: (error as Error)?.message ?? String(error) })
  }
}

export async function invalidateEntitlementCache(userId: string) {
  if (!redisEnabled()) return
  try {
    await getRedis().del(cacheKey(userId))
  } catch (error) {
    log.error('[entitlements] cache delete failed', { message: (error as Error)?.message ?? String(error) })
  }
}

async function readCache(userId: string): Promise<EntitlementCacheValue | null> {
  if (!redisEnabled()) return null
  try {
    const raw = await getRedis().get(cacheKey(userId))
    if (!raw) return null
    return JSON.parse(raw) as EntitlementCacheValue
  } catch (error) {
    log.error('[entitlements] cache read failed', { message: (error as Error)?.message ?? String(error) })
    return null
  }
}

export async function getSubscriptionEntitlementFromCache(userId: string): Promise<EntitlementCacheValue | null> {
  return await readCache(userId)
}

export async function getSubscriptionEntitlementByUser(userId: string): Promise<SubscriptionEntitlement | null> {
  const cached = await readCache(userId)
  if (cached) {
    return {
      subscriptionId: cached.subscriptionId,
      userId,
      status: cached.status,
      tier: cached.tier,
      currentPeriodEnd: cached.activeUntil ?? null,
      trialEndsAt: cached.trialEndsAt ?? null,
      seatQuantity: cached.seatQuantity ?? undefined,
      metadata: cached.metadata ?? null,
      entitlements: cached.entitlements ?? null,
      orgId: null,
      customerId: null,
      priceId: null,
      productId: null,
      cancelAtPeriodEnd: undefined,
      cancelAt: null,
      lastSyncedAt: cached.refreshedAt,
      updatedAt: cached.refreshedAt
    }
  }
  const row = await fetchEntitlementRowByUser(userId)
  if (!row) return null
  await writeCache(row)
  return rowToDomain(row)
}

export async function getSubscriptionEntitlementByOrg(orgId: string): Promise<SubscriptionEntitlement | null> {
  const row = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.orgId, orgId))
    .limit(1)
    .then((rows) => rows[0])

  if (!row) return null
  await writeCache(row)
  return rowToDomain(row)
}

async function fetchEntitlementRowByUser(userId: string): Promise<SubscriptionEntitlementRow | undefined> {
  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1)
  return rows[0]
}

async function fetchEntitlementRowBySubscription(subscriptionId: string): Promise<SubscriptionEntitlementRow | undefined> {
  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.polarSubscriptionId, subscriptionId))
    .limit(1)
  return rows[0]
}

type UpsertEntitlementInput = {
  subscriptionId: string
  userId: string
  orgId?: string | null
  status: string
  tier?: string | null
  productId?: string | null
  priceId?: string | null
  customerId?: string | null
  seatQuantity?: number | null
  currentPeriodEnd?: Date | string | null
  trialEndsAt?: Date | string | null
  cancelAt?: Date | string | null
  cancelAtPeriodEnd?: boolean
  metadata?: Record<string, unknown> | null
  entitlements?: Record<string, unknown> | null
  rawPayload?: Record<string, unknown> | null
  lastSyncedAt?: Date | string | null
  invalidateCache?: boolean
}

function normalizeDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function buildInsertPayload(input: UpsertEntitlementInput): SubscriptionEntitlementInsert {
  return {
    polarSubscriptionId: input.subscriptionId,
    userId: input.userId,
    orgId: input.orgId ?? null,
    status: input.status,
    tier: input.tier ?? null,
    productId: input.productId ?? null,
    priceId: input.priceId ?? null,
    customerId: input.customerId ?? null,
    seatQuantity: typeof input.seatQuantity === 'number' ? input.seatQuantity : null,
    currentPeriodEnd: normalizeDate(input.currentPeriodEnd),
    trialEndsAt: normalizeDate(input.trialEndsAt),
    cancelAt: normalizeDate(input.cancelAt),
    cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
    lastSyncedAt: normalizeDate(input.lastSyncedAt) ?? new Date(),
    entitlementsJson: input.entitlements ?? null,
    metadata: input.metadata ?? null,
    rawPayload: input.rawPayload ?? null,
    updatedAt: new Date()
  }
}

export async function upsertSubscriptionEntitlement(input: UpsertEntitlementInput): Promise<SubscriptionEntitlement> {
  const payload = buildInsertPayload(input)

  await db
    .insert(subscriptions)
    .values(payload)
    .onConflictDoUpdate({
      target: subscriptions.polarSubscriptionId,
      set: {
        ...payload,
        updatedAt: new Date()
      }
    })

  const row =
    (await fetchEntitlementRowBySubscription(input.subscriptionId)) ??
    (await fetchEntitlementRowByUser(input.userId))

  if (!row) {
    throw new Error('Failed to persist subscription entitlement')
  }

  if (input.invalidateCache) {
    await invalidateEntitlementCache(row.userId)
  } else {
    await writeCache(row)
  }

  return rowToDomain(row)
}

export async function clearSubscriptionEntitlement(subscriptionId: string) {
  const row = await fetchEntitlementRowBySubscription(subscriptionId)
  if (!row) return
  await db
    .delete(subscriptions)
    .where(
      and(
        eq(subscriptions.polarSubscriptionId, subscriptionId),
        eq(subscriptions.userId, row.userId)
      )
    )
  await invalidateEntitlementCache(row.userId)
}
