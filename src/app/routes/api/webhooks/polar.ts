// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, safeHandler } from '../utils'
import { session } from '@common/infra/session'

export const Route = createFileRoute('/api/webhooks/polar')({
  server: {
    handlers: {
      POST: safeHandler(async ({ request }) => {
        // Dev/mock: accept { orgId, plan, entitlements } and update cookie
        const body = await request.json().catch(() => ({}))
        const entitlements = body?.entitlements ?? { projectQuota: 5, dailyArticles: 1 }
        const plan = body?.plan ?? 'growth'
        const current = session.read(request) ?? { user: null }
        const next = {
          ...current,
          activeOrg: current.activeOrg ? { ...current.activeOrg, plan } : { id: 'org-dev', plan },
          entitlements
        }
        const cookie = session.set(next)
        return new Response(null, { status: 204, headers: { 'Set-Cookie': cookie } })
      })
    }
  }
})

