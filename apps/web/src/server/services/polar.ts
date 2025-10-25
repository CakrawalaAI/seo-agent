// @ts-nocheck
import { createHmac, timingSafeEqual } from 'node:crypto'
import { eq } from 'drizzle-orm'
import {
  EntitlementSchema,
  type Entitlement,
  type PolarWebhookEvent
} from '@seo-agent/domain'
import { appConfig } from '@seo-agent/platform'
import { getDb, schema, type Database } from '../db'

const SIGNATURE_PREFIX = 'sha256='
const V1_PREFIX = 'v1='
const TIMESTAMP_PREFIX = 't='

const MUTATING_EVENTS = new Set<PolarWebhookEvent['type']>([
  'subscription.created',
  'subscription.updated',
  'subscription.active',
  'subscription.canceled',
  'subscription.paused',
  'subscription.resumed',
  'entitlement.updated',
  'entitlement.synced'
])

export class PolarWebhookError extends Error {
  status: number
  code: string
  details?: unknown

  constructor(
    message: string,
    options: { status?: number; code?: string; details?: unknown } = {}
  ) {
    super(message)
    this.name = 'PolarWebhookError'
    this.status = options.status ?? 400
    this.code = options.code ?? 'polar_webhook_error'
    this.details = options.details
  }
}

type ParsedSignatureHeader = {
  signature: string | null
  timestamp: number | null
}

const parseSignatureHeader = (header: string): ParsedSignatureHeader => {
  const tokens = header.split(',').map((token) => token.trim()).filter(Boolean)
  let signature: string | null = null
  let timestamp: number | null = null

  for (const token of tokens) {
    if (!signature && token.startsWith(SIGNATURE_PREFIX)) {
      signature = token.slice(SIGNATURE_PREFIX.length)
      continue
    }
    if (!signature && token.startsWith(V1_PREFIX)) {
      signature = token.slice(V1_PREFIX.length)
      continue
    }
    if (timestamp === null && token.startsWith(TIMESTAMP_PREFIX)) {
      const value = Number.parseInt(token.slice(TIMESTAMP_PREFIX.length), 10)
      if (Number.isFinite(value)) {
        timestamp = value
      }
    }
  }

  if (!signature) {
    signature = header.trim() || null
  }

  return { signature, timestamp }
}

export const verifyPolarSignature = (
  payload: string,
  signatureHeader: string | null,
  secret: string,
  toleranceSeconds: number = 0
) => {
  if (!signatureHeader || !secret) {
    return false
  }

  const { signature, timestamp } = parseSignatureHeader(signatureHeader)
  if (!signature) {
    return false
  }

  if (toleranceSeconds > 0 && timestamp !== null) {
    const now = Math.floor(Date.now() / 1000)
    if (Math.abs(now - timestamp) > toleranceSeconds) {
      return false
    }
  }

  const expected = createHmac('sha256', secret).update(payload).digest('hex')

  try {
    return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))
  } catch (error) {
    console.error('Failed to verify Polar signature', error)
    return false
  }
}

type PolarOrgRecord = typeof schema.orgs.$inferSelect

type PolarOrgStore = {
  findOrg: (orgId: string) => Promise<PolarOrgRecord | null>
  updateOrg: (
    orgId: string,
    data: { plan: string; entitlements: Entitlement }
  ) => Promise<void>
}

const createPolarOrgStore = (db: Database): PolarOrgStore => ({
  findOrg: (orgId) =>
    db.query.orgs.findFirst({
      where: eq(schema.orgs.id, orgId)
    }),
  updateOrg: async (orgId, data) => {
    await db
      .update(schema.orgs)
      .set({ plan: data.plan, entitlements: data.entitlements })
      .where(eq(schema.orgs.id, orgId))
  }
})

export type PolarWebhookResult =
  | {
      status: 'ignored'
      eventType: PolarWebhookEvent['type']
    }
  | {
      status: 'updated'
      orgId: string
      plan: string
      entitlements: Entitlement
    }

export const processPolarWebhook = async (
  event: PolarWebhookEvent,
  options: { store?: PolarOrgStore } = {}
): Promise<PolarWebhookResult> => {
  if (!MUTATING_EVENTS.has(event.type)) {
    return { status: 'ignored', eventType: event.type }
  }

  const store = options.store ?? createPolarOrgStore(getDb())
  const org = await store.findOrg(event.data.orgId)

  if (!org) {
    throw new PolarWebhookError(`Org ${event.data.orgId} not found`, {
      status: 404,
      code: 'org_not_found'
    })
  }

  const currentEntitlementsResult = EntitlementSchema.safeParse(org.entitlements)
  if (!currentEntitlementsResult.success) {
    throw new PolarWebhookError('Org entitlements stored in database are invalid', {
      status: 500,
      code: 'invalid_org_entitlements',
      details: currentEntitlementsResult.error.flatten()
    })
  }

  const nextEntitlements = event.data.entitlements
    ? (() => {
        const parsed = EntitlementSchema.safeParse(event.data.entitlements)
        if (!parsed.success) {
          throw new PolarWebhookError('Invalid entitlements provided in webhook payload', {
            status: 400,
            code: 'invalid_entitlements',
            details: parsed.error.flatten()
          })
        }
        return parsed.data
      })()
    : currentEntitlementsResult.data

  await store.updateOrg(event.data.orgId, {
    plan: event.data.plan,
    entitlements: nextEntitlements
  })

  return {
    status: 'updated',
    orgId: event.data.orgId,
    plan: event.data.plan,
    entitlements: nextEntitlements
  }
}

export const getPolarWebhookSecret = () => appConfig.polar.webhookSecret
export const getPolarSignatureTolerance = () => appConfig.polar.toleranceSeconds
export const getPolarSignatureHeaderName = () => appConfig.polar.signatureHeader
