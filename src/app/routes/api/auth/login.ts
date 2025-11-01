import { createFileRoute, redirect } from '@tanstack/react-router'
import { safeHandler, httpError } from '@app/api-utils'
import { getBaseUrl, sanitizeRedirect } from '@common/auth/google'
import { buildGoogleAuthUrl } from '@common/auth/google'

export const Route = createFileRoute('/api/auth/login')({
  server: {
    handlers: {
      GET: safeHandler(({ request }) => {
        const url = new URL(request.url)
        const redirectTo = sanitizeRedirect(url.searchParams.get('redirect') || url.searchParams.get('to') || '/dashboard')
        const { url: authUrl, cookie } = buildGoogleAuthUrl(request, redirectTo)
        if ((process.env.SEOA_AUTH_DEBUG || '') === '1') {
          console.info('[auth/login]', {
            baseUrl: getBaseUrl(request),
            redirectTo,
            authUrl
          })
        }
        return new Response(null, { status: 302, headers: { Location: authUrl, 'Set-Cookie': cookie } })
      }),
    },
  },
})
