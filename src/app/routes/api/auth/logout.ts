import { createFileRoute } from '@tanstack/react-router'
import { safeHandler } from '@app/api-utils'
import { session } from '@common/infra/session'
import { clearTempCookie } from '@common/auth/google'

export const Route = createFileRoute('/api/auth/logout')({
  server: {
    handlers: {
      GET: safeHandler(() => {
        const headers = new Headers()
        headers.set('Location', '/')
        headers.append('Set-Cookie', session.clear())
        headers.append('Set-Cookie', clearTempCookie())
        // Clear legacy Better Auth cookies if present
        headers.append('Set-Cookie', clearName('better-auth.session_token'))
        headers.append('Set-Cookie', clearName('better-auth.state'))
        headers.append('Set-Cookie', clearName('seo-agent-session'))
        return new Response(null, { status: 302, headers })
      }),
    },
  },
})

function clearName(name: string) {
  return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
}
