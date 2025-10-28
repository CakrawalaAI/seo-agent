const COOKIE_NAME = 'seoa_session'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7 // 7 days

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
    return Buffer.from(json).toString('base64')
  },
  decode(raw: string | null | undefined): SessionPayload | null {
    if (!raw) return null
    try {
      const json = Buffer.from(raw, 'base64').toString('utf8')
      const parsed = JSON.parse(json) as SessionPayload
      return parsed
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
      maxAge
    })
  },
  clear() {
    return serializeCookie(COOKIE_NAME, '', {
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
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
  opts: { path?: string; httpOnly?: boolean; sameSite?: 'Lax' | 'Strict' | 'None'; maxAge?: number }
) {
  const attrs = [`${name}=${encodeURIComponent(value)}`]
  if (opts.path) attrs.push(`Path=${opts.path}`)
  if (opts.httpOnly) attrs.push('HttpOnly')
  if (opts.sameSite) attrs.push(`SameSite=${opts.sameSite}`)
  if (typeof opts.maxAge === 'number') attrs.push(`Max-Age=${Math.max(0, Math.floor(opts.maxAge))}`)
  return attrs.join('; ')
}
