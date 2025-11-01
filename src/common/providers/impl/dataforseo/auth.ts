export function getAuthHeader(): string | null {
  let login = process.env.DATAFORSEO_LOGIN || process.env.DATAFORSEO_EMAIL || ''
  let password = process.env.DATAFORSEO_PASSWORD || ''
  // If password looks like base64 and decodes to 'user:pass', prefer decoded pair
  if (password && isMaybeB64(password)) {
    const decoded = tryB64(password)
    if (decoded && decoded.includes(':')) {
      const [u, p] = decoded.split(':')
      login = u || login
      password = p
    }
  }
  if (!login || !password) return null
  return 'Basic ' + Buffer.from(`${login}:${password}`).toString('base64')
}

function isMaybeB64(s: string) {
  return /^[A-Za-z0-9+/=]+$/.test(s) && s.length % 4 === 0
}

function tryB64(s: string): string | null {
  try {
    return Buffer.from(s, 'base64').toString('utf-8')
  } catch {
    return null
  }
}
