// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, safeHandler, httpError } from '@app/api-utils'
import { session } from '@common/infra/session'
import { hasDatabase, getDb } from '@common/infra/db'
import { orgs } from '@entities/org/db/schema'

export const Route = createFileRoute('/api/webhooks/polar')({
  server: {
    handlers: {
      POST: safeHandler(async ({ request }) => {
        const secret = process.env.POLAR_WEBHOOK_SECRET
        let raw: string | null = null
        try { raw = await request.text() } catch { raw = null }
        const hdr = request.headers.get('x-polar-signature') || request.headers.get('X-Polar-Signature')
        if (secret && raw) {
          const ok = verifyHmacSha256(raw, secret, hdr)
          if (!ok) return httpError(401, 'Invalid signature')
        }
        const body = raw ? JSON.parse(raw) : await request.json().catch(() => ({}))
        const entitlements = body?.entitlements ?? { projectQuota: 5, dailyArticles: 1 }
        const plan = body?.plan ?? 'growth'
        const current = session.read(request) ?? { user: null }
        const next = {
          ...current,
          activeOrg: current.activeOrg ? { ...current.activeOrg, plan } : { id: 'org-dev', plan },
          entitlements
        }
        if (hasDatabase()) {
          try {
            const db = getDb()
            const orgId = next.activeOrg?.id ?? 'org-dev'
            await db
              .insert(orgs)
              .values({ id: orgId, name: orgId, plan, entitlementsJson: entitlements })
              .onConflictDoUpdate({ target: orgs.id, set: { plan, entitlementsJson: entitlements, updatedAt: new Date() as any } })
          } catch {}
        }
        const cookie = session.set(next)
        return new Response(null, { status: 204, headers: { 'Set-Cookie': cookie } })
      })
    }
  }
})

function verifyHmacSha256(raw: string, secret: string, header: string | null) {
  if (!header) return false
  try {
    const crypto = require('node:crypto') as typeof import('node:crypto')
    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(raw)
    const digest = hmac.digest('hex')
    const expected = `sha256=${digest}`
    return timingSafeEqual(expected, header)
  } catch {
    return false
  }
}

function timingSafeEqual(a: string, b: string) {
  try {
    const crypto = require('node:crypto') as typeof import('node:crypto')
    const ba = Buffer.from(a)
    const bb = Buffer.from(b)
    if (ba.length !== bb.length) return false
    return crypto.timingSafeEqual(ba, bb)
  } catch {
    return a === b
  }
}
