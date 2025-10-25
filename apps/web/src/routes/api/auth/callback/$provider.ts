// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { handleAuthRequest } from '@seo-agent/auth'
import { safeHandler } from '../../utils'

export const Route = createFileRoute('/api/auth/callback/$provider')({
  server: {
    handlers: {
      GET: safeHandler(({ request }) => handleAuthRequest(request)),
      POST: safeHandler(({ request }) => handleAuthRequest(request))
    }
  }
})
