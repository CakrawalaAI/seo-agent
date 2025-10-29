import { createFileRoute, redirect } from '@tanstack/react-router'
import { safeHandler, httpError } from '@app/api-utils'
import { buildGoogleAuthUrl } from '@common/auth/google'

export const Route = createFileRoute('/api/auth/login')({
  server: {
    handlers: {
      GET: safeHandler(({ request }) => {
        const url = new URL(request.url)
        const redirectTo = url.searchParams.get('redirect') || url.searchParams.get('to') || '/dashboard'
        const { url: authUrl, cookie } = buildGoogleAuthUrl(request, redirectTo)
        return new Response(null, { status: 302, headers: { Location: authUrl, 'Set-Cookie': cookie } })
      }),
    },
  },
})

