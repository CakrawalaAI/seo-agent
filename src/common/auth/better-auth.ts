// Lightweight Google OAuth helpers (used instead of full better-auth runtime integration)
// Env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SEOA_GOOGLE_REDIRECT_URL

type GoogleProfile = { email?: string; name?: string; picture?: string }

export function googleEnabled() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}

export function buildGoogleAuthUrl(state = '') {
  const clientId = process.env.GOOGLE_CLIENT_ID || ''
  const redirectUri = process.env.SEOA_GOOGLE_REDIRECT_URL || ''
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    access_type: 'offline',
    scope: 'openid email profile',
    include_granted_scopes: 'true'
  })
  if (state) params.set('state', state)
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

export async function exchangeGoogleCode(code: string): Promise<GoogleProfile | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID || ''
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || ''
  const redirectUri = process.env.SEOA_GOOGLE_REDIRECT_URL || ''
  if (!clientId || !clientSecret || !redirectUri) return null
  try {
    const body = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    })
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body
    })
    if (!tokenRes.ok) return null
    const tokenJson = (await tokenRes.json()) as { access_token?: string }
    const access = tokenJson?.access_token
    if (!access) return null
    const profRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access}` }
    })
    if (!profRes.ok) return null
    const prof = (await profRes.json()) as GoogleProfile
    return prof
  } catch {
    return null
  }
}

