import crypto from 'crypto'

const COOKIE_NAME = 'seoa_session'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7 // 7 days
const VERSION = 'v1'

export type SessionPayload = {
  user: { email: string; name?: string | null } | null
  orgs?: Array<{ id: string; name: string; plan?: string }>
  activeOrg?: { id: string; plan?: string }
  activeProjectId?: string | null
  entitlements?: { projectQuota?: number; dailyArticles?: number; monthlyPostCredits?: number }
}

export const session = {
  name: COOKIE_NAME,
  encode(value: SessionPayload): string {
    const json = JSON.stringify(value)
    const b64 = Buffer.from(json).toString('base64')
    const sig = sign(b64)
    return `${VERSION}|${b64}|${sig}`
  },
  decode(raw: string | null | undefined): SessionPayload | null {
    if (!raw) return null
    // Accept signed format: v1|b64|sig and legacy base64-only for backward compat
    const parts = raw.split('|')
    if (parts.length === 3 && parts[0] === VERSION) {
      const [, b64, sig] = parts
      if (!timingSafeEqual(sign(b64), sig)) return null
      try {
        const json = Buffer.from(b64, 'base64').toString('utf8')
        return JSON.parse(json) as SessionPayload
      } catch {
        return null
      }
    }
    // legacy fallback
    try {
      const json = Buffer.from(raw, 'base64').toString('utf8')
      return JSON.parse(json) as SessionPayload
    } catch {
      return null
    }
  },
  read(request: Request): SessionPayload | null {
    const raw = getCookie(request, COOKIE_NAME)
    return this.decode(raw)
  },
  set(value: SessionPayload, options: { maxAgeSeconds?: number } = {}) {
    const encoded = this.encode(value)
    const maxAge = options.maxAgeSeconds ?? MAX_AGE_SECONDS
    return serializeCookie(COOKIE_NAME, encoded, {
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge
    })
  },
  clear() {
    return serializeCookie(COOKIE_NAME, '', {
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 0
    })
  }
}

function getCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie')
  if (!header) return null
  const parts = header.split(/;\s*/)
  for (const part of parts) {
    const [k, v] = part.split('=')
    if (k === name) return decodeURIComponent(v ?? '')
  }
  return null
}

function serializeCookie(
  name: string,
  value: string,
  opts: { path?: string; httpOnly?: boolean; sameSite?: 'Lax' | 'Strict' | 'None'; maxAge?: number; secure?: boolean }
) {
  const attrs = [`${name}=${encodeURIComponent(value)}`]
  if (opts.path) attrs.push(`Path=${opts.path}`)
  if (opts.httpOnly) attrs.push('HttpOnly')
  if (opts.sameSite) attrs.push(`SameSite=${opts.sameSite}`)
  if (opts.secure) attrs.push('Secure')
  if (typeof opts.maxAge === 'number') attrs.push(`Max-Age=${Math.max(0, Math.floor(opts.maxAge))}`)
  return attrs.join('; ')
}

function sign(b64: string): string {
  const secret = process.env.SESSION_SECRET || 'dev-insecure-secret-change-me'
  return crypto.createHmac('sha256', secret).update(b64).digest('hex')
}

function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}
