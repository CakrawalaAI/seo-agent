// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { session } from '@common/infra/session'
import { json } from './utils'

export const Route = createFileRoute('/api/me')({
  server: {
    handlers: {
      GET: ({ request }) => {
        const sess = session.read(request)
        if (!sess) return json({ user: null, activeOrg: null, entitlements: null, orgs: [] })
        return json({
          user: sess.user,
          activeOrg: sess.activeOrg ?? null,
          entitlements: sess.entitlements ?? null,
          orgs: sess.orgs ?? []
        })
      }
    }
  }
})

