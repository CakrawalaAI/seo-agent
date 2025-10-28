// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, safeHandler } from '@app/api-utils'

export const Route = createFileRoute('/api/auth/sign-in/social')({
  server: {
    handlers: {
      POST: safeHandler(async ({ request }) => {
        const body = await request.json().catch(() => ({}))
        const callbackURL = typeof body?.callbackURL === 'string' ? body.callbackURL : '/dashboard'
        // Prefer external better-auth sign-in URL if provided
        const external = process.env.BETTER_AUTH_SIGNIN_URL
        const url = external
          ? external
          : `/api/auth/callback/mock?next=${encodeURIComponent(callbackURL)}`
        return json({ url })
      })
    }
  }
})
