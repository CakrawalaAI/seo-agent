// @ts-nocheck
import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'bun:test'
import type { Entitlement, PolarWebhookEvent } from '@seo-agent/domain'
import {
  PolarWebhookError,
  processPolarWebhook,
  verifyPolarSignature
} from '../polar'

type MutableOrg = {
  id: string
  plan: string
  entitlements: Entitlement
}

const baseEntitlements: Entitlement = {
  projectQuota: 1,
  crawlPages: 200,
  dailyArticles: 1,
  autoPublishPolicy: 'buffered',
  bufferDays: 3
}

const createTestStore = (org: MutableOrg) => {
  const state: MutableOrg = JSON.parse(JSON.stringify(org))

  return {
    state,
    findOrg: async (orgId: string) => (orgId === state.id ? { ...state } : null),
    updateOrg: async (orgId: string, data: { plan: string; entitlements: Entitlement }) => {
      if (orgId !== state.id) {
        throw new Error('Org not found in store')
      }
      state.plan = data.plan
      state.entitlements = data.entitlements
    }
  }
}

describe('verifyPolarSignature', () => {
  const payload = JSON.stringify({ hello: 'polar' })
  const secret = 'test_secret'
  const digest = createHmac('sha256', secret).update(payload).digest('hex')

  it('validates sha256 signature headers', () => {
    const header = `sha256=${digest}`
    expect(verifyPolarSignature(payload, header, secret, 0)).toBe(true)
  })

  it('rejects invalid signatures', () => {
    const header = `sha256=${'0'.repeat(digest.length)}`
    expect(verifyPolarSignature(payload, header, secret, 0)).toBe(false)
  })

  it('accepts timestamped signatures within tolerance', () => {
    const now = Math.floor(Date.now() / 1000)
    const header = `t=${now},sha256=${digest}`
    expect(verifyPolarSignature(payload, header, secret, 300)).toBe(true)
  })
})

describe('processPolarWebhook', () => {
  const createEvent = (overrides: Partial<PolarWebhookEvent>): PolarWebhookEvent => {
    const base: PolarWebhookEvent = {
      type: 'subscription.updated',
      data: {
        orgId: 'org_1',
        plan: 'starter',
        entitlements: baseEntitlements
      }
    }

    return {
      ...base,
      ...overrides,
      data: {
        ...base.data,
        ...(overrides.data ?? {})
      }
    }
  }

  it('updates plan and entitlements for recognized events', async () => {
    const store = createTestStore({
      id: 'org_1',
      plan: 'starter',
      entitlements: baseEntitlements
    })

    const event = createEvent({
      data: {
        orgId: 'org_1',
        plan: 'pro',
        entitlements: {
          ...baseEntitlements,
          dailyArticles: 3,
          projectQuota: 2
        }
      }
    })

    const result = await processPolarWebhook(event, { store })
    expect(result.status).toBe('updated')
    expect(result.plan).toBe('pro')
    expect(store.state.plan).toBe('pro')
    expect(store.state.entitlements.dailyArticles).toBe(3)
    expect(store.state.entitlements.projectQuota).toBe(2)
  })

  it('retains existing entitlements when payload omits them', async () => {
    const store = createTestStore({
      id: 'org_1',
      plan: 'starter',
      entitlements: baseEntitlements
    })

    const event = createEvent({
      type: 'subscription.canceled',
      data: {
        orgId: 'org_1',
        plan: 'free',
        entitlements: undefined
      }
    })

    const result = await processPolarWebhook(event, { store })
    expect(result.status).toBe('updated')
    expect(result.plan).toBe('free')
    expect(store.state.entitlements).toEqual(baseEntitlements)
  })

  it('ignores unhandled events', async () => {
    const store = createTestStore({
      id: 'org_1',
      plan: 'starter',
      entitlements: baseEntitlements
    })

    const event = createEvent({ type: 'ping', data: { orgId: 'org_1', plan: 'starter' } })
    const result = await processPolarWebhook(event, { store })
    expect(result.status).toBe('ignored')
    expect(store.state.plan).toBe('starter')
  })

  it('throws when organization is missing', async () => {
    const store = createTestStore({
      id: 'another_org',
      plan: 'starter',
      entitlements: baseEntitlements
    })

    const event = createEvent({ data: { orgId: 'missing', plan: 'pro' } })

    await expect(async () => {
      await processPolarWebhook(event, { store })
    }).rejects.toBeInstanceOf(PolarWebhookError)
  })
})
