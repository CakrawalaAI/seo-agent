import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler } from '@app/api-utils'
import { getDiscoveryOverride, setDiscoveryOverride } from '@common/providers/overrides'

const COOKIE_NAME = 'seo_dev_discovery'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30

function isProd() {
  return process.env.NODE_ENV === 'production'
}

function buildCookie(value: 'mock' | 'dataforseo' | null) {
  const parts = [`${COOKIE_NAME}=${value ? encodeURIComponent(value) : ''}`, 'Path=/', 'SameSite=Lax']
  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure')
  }
  parts.push(`Max-Age=${value ? COOKIE_MAX_AGE : 0}`)
  return parts.join('; ')
}

function readCookie(request: Request): 'mock' | 'dataforseo' | null {
  const header = request.headers.get('cookie')
  if (!header) return null
  const entries = header.split(/;\s*/)
  for (const entry of entries) {
    const [name, raw] = entry.split('=')
    if (name === COOKIE_NAME) {
      const decoded = decodeURIComponent(raw || '')
      if (decoded === 'mock') return 'mock'
      if (decoded === 'dataforseo') return 'dataforseo'
      return null
    }
  }
  return null
}

function ensureOverrideFromCookie(request: Request) {
  const cookieValue = readCookie(request)
  if (cookieValue) {
    setDiscoveryOverride(cookieValue)
  }
}

export const Route = createFileRoute('/api/dev/providers')({
  server: {
    handlers: {
      GET: safeHandler(async ({ request }) => {
        if (isProd()) {
          return new Response('Not found', { status: 404 })
        }
        ensureOverrideFromCookie(request)
        return json({ discovery: getDiscoveryOverride() })
      }),
      POST: safeHandler(async ({ request }) => {
        if (isProd()) {
          return new Response('Not found', { status: 404 })
        }
        ensureOverrideFromCookie(request)
        let payload: unknown
        try {
          payload = await request.json()
        } catch {
          throw httpError(400, 'Invalid JSON body')
        }
        const discoveryRaw = (payload as Record<string, unknown>)?.discovery
        let next: 'mock' | 'dataforseo' | null = null
        if (discoveryRaw === 'mock') next = 'mock'
        else if (discoveryRaw === 'dataforseo') next = 'dataforseo'
        else if (discoveryRaw === null || discoveryRaw === undefined || discoveryRaw === 'default' || discoveryRaw === 'real') {
          next = null
        } else {
          throw httpError(400, 'Invalid discovery provider override')
        }
        setDiscoveryOverride(next)
        const response = json({ discovery: getDiscoveryOverride() })
        response.headers.append('Set-Cookie', buildCookie(next))
        return response
      })
    }
  }
})

