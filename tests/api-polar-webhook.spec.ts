import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createHmac } from 'node:crypto'

import { handlePolarWebhook } from '@app/routes/api/billing/webhooks/polar'
import { organizations } from '@entities/org/db/schema'

vi.mock('@src/common/logger', () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

const upsertMock = vi.fn()

vi.mock('@entities/subscription/service', () => ({
  upsertSubscriptionEntitlement: upsertMock
}))

const updateWhere = vi.fn().mockResolvedValue(undefined)
const updateSet = vi.fn()
const dbUpdate = vi.fn((table: unknown) => ({
  set: (values: unknown) => {
    updateSet(values)
    return {
      where: (clause: unknown) => updateWhere(clause)
    }
  }
}))

vi.mock('@common/infra/db', () => ({
  db: {
    update: dbUpdate
  }
}))

function sign(body: string, secret: string) {
  return createHmac('sha256', secret).update(body).digest('hex')
}

function buildRequest(eventType: string, data: Record<string, unknown>) {
  const secret = process.env.POLAR_WEBHOOK_SECRET ?? ''
  const body = JSON.stringify({ type: eventType, data })
  const signature = sign(body, secret)
  return new Request('http://localhost/api/billing/webhooks/polar', {
    method: 'POST',
    headers: {
      'x-polar-signature': `sha256=${signature}`
    },
    body
  })
}

describe('polar webhook handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(process.env as Record<string, string>).POLAR_WEBHOOK_SECRET = 'test-secret'
    updateWhere.mockClear()
    updateSet.mockClear()
    dbUpdate.mockClear()
    upsertMock.mockClear()
  })

  it('persists active subscription entitlements', async () => {
    const subscription = {
      id: 'sub_active',
      status: 'active',
      metadata: {
        orgId: 'org-123',
        userId: 'user-123',
        unit_posts: 10
      },
      product: { name: 'Pro Plan' },
      seats: 2,
      current_period_end: '2025-11-30T00:00:00Z'
    }

    const req = buildRequest('subscription.active', subscription)
    const res = await handlePolarWebhook(req)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true })

    expect(upsertMock).toHaveBeenCalledTimes(1)
    expect(upsertMock.mock.calls[0]?.[0]).toMatchObject({
      subscriptionId: 'sub_active',
      status: 'active',
      userId: 'user-123',
      orgId: 'org-123',
      seatQuantity: 2,
      tier: 'Pro Plan'
    })

    expect(dbUpdate).toHaveBeenCalledWith(organizations)
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: 'Pro Plan',
        entitlementsJson: expect.objectContaining({
          status: 'active',
          monthlyPostCredits: 20,
          seatQuantity: 2
        })
      })
    )
    expect(updateWhere).toHaveBeenCalledTimes(1)
  })

  it('downgrades revoked subscription to starter', async () => {
    const subscription = {
      id: 'sub_revoked',
      status: 'revoked',
      metadata: {
        orgId: 'org-789',
        userId: 'user-789',
        unit_posts: 12
      },
      seats: 1,
      current_period_end: '2025-12-31T00:00:00Z'
    }

    const req = buildRequest('subscription.revoked', subscription)
    const res = await handlePolarWebhook(req)

    expect(res.status).toBe(200)
    expect(upsertMock).toHaveBeenCalledTimes(1)
    expect(upsertMock.mock.calls[0]?.[0]).toMatchObject({ status: 'revoked' })

    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: 'starter',
        entitlementsJson: expect.objectContaining({
          status: 'revoked',
          monthlyPostCredits: 0
        })
      })
    )
  })
})
