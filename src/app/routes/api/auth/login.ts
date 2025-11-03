import { createFileRoute } from '@tanstack/react-router'
import { safeHandler, httpError } from '@app/api-utils'
import { getBaseUrl, sanitizeRedirect, buildGoogleAuthUrl, GoogleOAuthConfigError } from '@common/auth/google'

export const Route = createFileRoute('/api/auth/login')({
  server: {
    handlers: {
      GET: safeHandler(({ request }) => {
        const url = new URL(request.url)
        const redirectTo = sanitizeRedirect(url.searchParams.get('redirect') || url.searchParams.get('to') || '/dashboard')
        let authUrl: string
        let cookie: string
        try {
          const result = buildGoogleAuthUrl(request, { redirectTo })
          authUrl = result.url
          cookie = result.cookie
        } catch (error) {
          if (error instanceof GoogleOAuthConfigError) {
            console.error('[auth/login] missing Google OAuth client configuration')
            return httpError(500, 'Google OAuth not configured')
          }
          throw error
        }
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
