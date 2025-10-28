// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, safeHandler } from '@app/api-utils'
import { buildGoogleAuthUrl, googleEnabled } from '@common/auth/better-auth'

export const Route = createFileRoute('/api/auth/sign-in/google')({
  server: {
    handlers: {
      POST: safeHandler(async ({ request }) => {
        const body = await request.json().catch(() => ({}))
        const state = String(body?.state || '')
        if (!googleEnabled()) {
          // fall back to mock flow
          const next = typeof body?.callbackURL === 'string' ? body.callbackURL : '/dashboard'
          return json({ url: `/api/auth/callback/mock?next=${encodeURIComponent(next)}` })
        }
        const url = buildGoogleAuthUrl(state)
        return json({ url })
      })
    }
  }
})

