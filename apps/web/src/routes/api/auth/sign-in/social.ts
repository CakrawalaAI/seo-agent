// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { handleAuthRequest } from '@seo-agent/auth'
import { safeHandler } from '../../utils'

export const Route = createFileRoute('/api/auth/sign-in/social')({
  server: {
    handlers: {
      POST: safeHandler(({ request }) => handleAuthRequest(request))
    }
  }
})
