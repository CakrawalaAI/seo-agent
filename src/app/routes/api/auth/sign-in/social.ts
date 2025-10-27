// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, safeHandler } from '../../utils'

export const Route = createFileRoute('/api/auth/sign-in/social')({
  server: {
    handlers: {
      POST: safeHandler(async ({ request }) => {
        const body = await request.json().catch(() => ({}))
        const callbackURL = typeof body?.callbackURL === 'string' ? body.callbackURL : '/dashboard'
        // For MVP dev: redirect to our mock callback which sets a session
        const url = `/api/auth/callback/mock?next=${encodeURIComponent(callbackURL)}`
        return json({ url })
      })
    }
  }
})

