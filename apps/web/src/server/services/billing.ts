// @ts-nocheck
import { randomUUID } from 'node:crypto'
import { eq, sql } from 'drizzle-orm'
import {
  BillingLinkResponseSchema,
  EntitlementSchema,
  type Entitlement
} from '@seo-agent/domain'
import type { BillingCheckoutRequest, BillingPortalRequest } from '@seo-agent/domain'
import { getDb, schema, type Database } from '../db'
import { appConfig } from '@seo-agent/platform'

const appendSessionToUrl = (base: string, sessionId: string) => {
  const url = new URL(base)
  const path = url.pathname.replace(/\/$/, '')
  url.pathname = `${path}/${sessionId}`
  return url
}

export class BillingAuthorizationError extends Error {
  status: number
  code: string
  details?: unknown

  constructor(
    message: string,
    options: { status?: number; code?: string; details?: unknown } = {}
  ) {
    super(message)
    this.name = 'BillingAuthorizationError'
    this.status = options.status ?? 402
    this.code = options.code ?? 'billing_required'
    this.details = options.details
  }
}

type OrgRecord = typeof schema.orgs.$inferSelect

export type BillingContext = {
  org: OrgRecord
  entitlements: Entitlement
  projectCount: number
}

const countOrgProjects = async (db: Database, orgId: string) => {
  const result = await db
    .select({ value: sql<number>`count(*)` })
    .from(schema.projects)
    .where(eq(schema.projects.orgId, orgId))
  return Number(result[0]?.value ?? 0)
}

export const resolveOrgBillingContext = async (orgId: string): Promise<BillingContext> => {
  const db = getDb()
  const org = await db.query.orgs.findFirst({
    where: eq(schema.orgs.id, orgId)
  })

  if (!org) {
    throw new BillingAuthorizationError(`Org ${orgId} not found`, {
      status: 404,
      code: 'org_not_found'
    })
  }

  const entitlementsResult = EntitlementSchema.safeParse(org.entitlements)
  if (!entitlementsResult.success) {
    throw new BillingAuthorizationError('Stored entitlements failed validation', {
      status: 500,
      code: 'invalid_org_entitlements',
      details: entitlementsResult.error.flatten()
    })
  }

  const projectCount = await countOrgProjects(db, orgId)

  return {
    org,
    entitlements: entitlementsResult.data,
    projectCount
  }
}

export const ensureProjectSlotAvailable = async (orgId: string) => {
  const context = await resolveOrgBillingContext(orgId)
  const { entitlements, projectCount } = context

  if (entitlements.projectQuota > 0 && projectCount >= entitlements.projectQuota) {
    throw new BillingAuthorizationError('Project quota exceeded', {
      status: 402,
      code: 'project_quota_exceeded',
      details: {
        allowed: entitlements.projectQuota,
        current: projectCount
      }
    })
  }

  return context
}

export const getOrgEntitlements = async (orgId: string): Promise<Entitlement> => {
  const context = await resolveOrgBillingContext(orgId)
  return context.entitlements
}

export const createCheckoutLink = async (payload: BillingCheckoutRequest) => {
  const db = getDb()
  const org = await db.query.orgs.findFirst({
    where: eq(schema.orgs.id, payload.orgId)
  })
  if (!org) {
    throw Object.assign(new Error('Org not found'), { status: 404 })
  }

  const url = appendSessionToUrl(appConfig.urls.billingCheckoutBase, randomUUID())
  url.searchParams.set('orgId', payload.orgId)
  url.searchParams.set('plan', payload.plan)
  url.searchParams.set('success_url', payload.successUrl)
  url.searchParams.set('cancel_url', payload.cancelUrl)

  return BillingLinkResponseSchema.parse({ url: url.toString() })
}

export const getPortalLink = async (payload: BillingPortalRequest) => {
  const db = getDb()
  const org = await db.query.orgs.findFirst({
    where: eq(schema.orgs.id, payload.orgId)
  })
  if (!org) {
    throw Object.assign(new Error('Org not found'), { status: 404 })
  }

  const url = new URL(appConfig.urls.billingPortalBase)
  url.searchParams.set('orgId', payload.orgId)
  if (payload.returnUrl) {
    url.searchParams.set('return_url', payload.returnUrl)
  }

  return BillingLinkResponseSchema.parse({ url: url.toString() })
}
