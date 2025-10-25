// @ts-nocheck
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { BillingLinkResponseSchema } from '@seo-agent/domain'
import type { BillingCheckoutRequest, BillingPortalRequest } from '@seo-agent/domain'
import { getDb, schema } from '../db'
import { appConfig } from '@seo-agent/platform'

const appendSessionToUrl = (base: string, sessionId: string) => {
  const url = new URL(base)
  const path = url.pathname.replace(/\/$/, '')
  url.pathname = `${path}/${sessionId}`
  return url
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
