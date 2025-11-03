export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'unpaid'
  | (string & {})

export type SubscriptionEntitlement = {
  subscriptionId: string
  userId: string
  orgId?: string | null
  status: SubscriptionStatus
  tier?: string | null
  productId?: string | null
  priceId?: string | null
  customerId?: string | null
  seatQuantity?: number | null
  currentPeriodEnd?: string | null
  trialEndsAt?: string | null
  cancelAt?: string | null
  cancelAtPeriodEnd?: boolean
  metadata?: Record<string, unknown> | null
  entitlements?: Record<string, unknown> | null
  lastSyncedAt?: string | null
  updatedAt?: string | null
}

export type EntitlementCacheValue = {
  subscriptionId: string
  status: SubscriptionStatus
  activeUntil?: string | null
  tier?: string | null
  trialEndsAt?: string | null
  seatQuantity?: number | null
  metadata?: Record<string, unknown> | null
  entitlements?: Record<string, unknown> | null
  refreshedAt: string
}
