export function getAuthHeader(): string | null {
  const token = normalizeAuth(process.env.DATAFORSEO_AUTH)
  return token ? `Basic ${token}` : null
}

function normalizeAuth(raw: string | undefined | null): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('Basic ')) {
    return trimmed.slice(6).trim() || null
  }
  if (isMaybeB64(trimmed)) return trimmed
  if (trimmed.includes(':')) {
    return Buffer.from(trimmed, 'utf-8').toString('base64')
  }
  return null
}

function isMaybeB64(s: string) {
  return /^[A-Za-z0-9+/=]+$/.test(s) && s.length % 4 === 0
}
