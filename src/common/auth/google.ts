import crypto from 'crypto'
import { hasDatabase, getDb } from '@common/infra/db'
import { users, userAuthProviders } from '@entities/auth/db/schema'
import { and, eq } from 'drizzle-orm'

const OAUTH_COOKIE = 'seoa_oauth'

export class GoogleOAuthConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GoogleOAuthConfigError'
  }
}

export function getBaseUrl(request: Request): string {
  // Prefer explicit APP_URL to avoid port mismatches between login and callback
  const env = process.env.APP_URL
  if (env) return env.replace(/\/$/, '')
  const url = new URL(request.url)
  const proto = normalizeProto(request.headers.get('x-forwarded-proto')) || url.protocol.replace(':', '')
  const host =
    normalizeHost(request.headers.get('x-forwarded-host')) ||
    normalizeHost(request.headers.get('host')) ||
    url.host
  const base = `${proto}://${host}`
  return base
}

function normalizeProto(value: string | null): string | null {
  if (!value) return null
  const first = value.split(',')[0]?.trim().toLowerCase()
  if (!first) return null
  if (first.includes('://')) {
    const split = first.split('://')[0]
    if (split === 'http' || split === 'https') return split
    return null
  }
  if (first === 'http' || first === 'https') return first
  return null
}

function normalizeHost(value: string | null): string | null {
  if (!value) return null
  const first = value.split(',')[0]?.trim()
  if (!first) return null
  const stripped = first.replace(/^[a-z]+:\/\//i, '')
  const host = stripped.split('/')[0]
  return host || null
}

export function sanitizeRedirect(redirectTo?: string | null): string {
  const def = '/dashboard'
  if (!redirectTo || typeof redirectTo !== 'string') return def
  if (!redirectTo.startsWith('/')) return def
  if (redirectTo.startsWith('//')) return def
  return redirectTo
}

export function buildGoogleAuthUrl(
  request: Request,
  options?: { redirectTo?: string; payload?: Record<string, unknown> | null }
) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) {
    throw new GoogleOAuthConfigError('missing_google_client_id')
  }
  const redirectUri = `${getBaseUrl(request)}/api/auth/callback/google`
  const state = randomId('st_')
  const scope = encodeURIComponent('openid email profile')
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&response_type=code&redirect_uri=${encodeURIComponent(
    redirectUri,
  )}&scope=${scope}&state=${encodeURIComponent(state)}&access_type=offline&prompt=consent`
  const cookie = setTempCookie({
    state,
    redirectTo: sanitizeRedirect(options?.redirectTo),
    payload: options?.payload ?? null
  })
  return { url, cookie }
}

export async function exchangeCodeForTokens(request: Request, code: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new GoogleOAuthConfigError('missing_google_credentials')
  }
  const redirectUri = `${getBaseUrl(request)}/api/auth/callback/google`
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  })
  const tokenUrl = 'https://oauth2.googleapis.com/token'
  const resp = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!resp.ok) {
    let detail = ''
    try {
      const j = await resp.json()
      detail = ` ${j.error || ''} ${j.error_description || ''}`.trim()
    } catch {
      try { detail = ` status=${resp.status}` } catch {}
    }
    if ((process.env.SEOA_AUTH_DEBUG || '') === '1') {
      console.error('[auth/token] exchange failed', { status: resp.status, detail, redirectUri })
    }
    throw new Error(`token_exchange_failed${detail ? `: ${detail}` : ''} redirect_uri=${redirectUri}`)
  }
  return (await resp.json()) as {
    access_token: string
    id_token?: string
    refresh_token?: string
    token_type: string
    expires_in: number
  }
}

export async function fetchGoogleUser(accessToken: string) {
  const resp = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!resp.ok) throw new Error('userinfo_failed')
  return (await resp.json()) as {
    sub: string
    email: string
    name?: string
    picture?: string
    email_verified?: boolean
  }
}

export async function upsertUserFromGoogle(profile: { sub: string; email: string; name?: string; picture?: string | null }) {
  if (!hasDatabase()) return { userId: profile.sub } // stateless fallback
  const db = getDb()
  // 1) try account link
  const acc = await db
    .select()
    .from(userAuthProviders)
    // @ts-ignore drizzle type narrowing
    .where(and(eq(userAuthProviders.providerId as any, 'google'), eq(userAuthProviders.providerAccountId as any, profile.sub)))
    .limit(1)
  let userId: string | null = (acc as any)?.[0]?.userId ?? null
  if (!userId) {
    // 2) try by email
    const existing = await db.select().from(users).where(eq(users.email, profile.email)).limit(1)
    if ((existing as any)?.[0]) {
      userId = (existing as any)[0].id as string
    }
  }
  if (!userId) {
    userId = randomId('usr_')
    try {
      // @ts-ignore drizzle types
      await db.insert(users).values({ id: userId, email: profile.email, name: profile.name ?? null, image: profile.picture ?? null })
    } catch {}
  }
  // ensure account link exists
  try {
    // @ts-ignore drizzle types
    await db
      .insert(userAuthProviders)
      .values({
        id: randomId('uap_'),
        userId,
        providerId: 'google' as any,
        providerAccountId: profile.sub,
        accessToken: null,
        refreshToken: null,
        rawJson: null
      })
      .onConflictDoNothing?.()
  } catch {}
  return { userId }
}

export function parseTempCookie(request: Request): { state?: string; redirectTo?: string | null; payload?: Record<string, unknown> | null } {
  const header = request.headers.get('cookie') || ''
  const m = header.match(new RegExp(`${OAUTH_COOKIE}=([^;]+)`))
  if (!m) return {}
  try {
    const json = Buffer.from(decodeURIComponent(m[1]!), 'base64').toString('utf8')
    return JSON.parse(json)
  } catch {
    return {}
  }
}

export function clearTempCookie() {
  return serializeCookie(OAUTH_COOKIE, '', { path: '/', httpOnly: true, sameSite: 'Lax', secure: process.env.NODE_ENV === 'production', maxAge: 0 })
}

function setTempCookie(value: { state: string; redirectTo?: string | null; payload?: Record<string, unknown> | null }) {
  const raw = Buffer.from(JSON.stringify(value)).toString('base64')
  return serializeCookie(OAUTH_COOKIE, raw, { path: '/', httpOnly: true, sameSite: 'Lax', secure: process.env.NODE_ENV === 'production', maxAge: 10 * 60 })
}

function serializeCookie(name: string, value: string, opts: { path?: string; httpOnly?: boolean; sameSite?: 'Lax' | 'Strict' | 'None'; maxAge?: number; secure?: boolean }) {
  const parts = [`${name}=${encodeURIComponent(value)}`]
  if (opts.path) parts.push(`Path=${opts.path}`)
  if (opts.httpOnly) parts.push('HttpOnly')
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`)
  if (opts.secure) parts.push('Secure')
  if (typeof opts.maxAge === 'number') parts.push(`Max-Age=${Math.max(0, Math.floor(opts.maxAge))}`)
  return parts.join('; ')
}

function randomId(prefix = '') {
  return prefix + crypto.randomBytes(10).toString('hex')
}
