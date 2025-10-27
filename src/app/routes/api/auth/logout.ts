// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { session } from '@common/infra/session'

export const Route = createFileRoute('/api/auth/logout')({
  server: {
    handlers: {
      POST: async () =>
        new Response(null, {
          status: 204,
          headers: { 'Set-Cookie': session.clear() }
        })
    }
  }
})

