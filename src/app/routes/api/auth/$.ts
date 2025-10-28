// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { auth } from '@common/auth/server'

// Catch-all Better Auth handler
export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: ({ request }) => auth.handler(request),
      POST: ({ request }) => auth.handler(request)
    }
  }
})

