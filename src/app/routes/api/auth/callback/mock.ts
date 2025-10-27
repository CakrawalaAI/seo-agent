// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { session } from '@common/infra/session'

export const Route = createFileRoute('/api/auth/callback/mock')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const next = url.searchParams.get('next') || '/dashboard'
        const cookie = session.set({
          user: { email: 'dev@example.com', name: 'Dev User' },
          orgs: [{ id: 'org-dev', name: 'Dev Org', plan: 'starter' }],
          activeOrg: { id: 'org-dev', plan: 'starter' },
          entitlements: { projectQuota: 3, dailyArticles: 1 }
        })
        return new Response(null, {
          status: 302,
          headers: { Location: next, 'Set-Cookie': cookie }
        })
      }
    }
  }
})

