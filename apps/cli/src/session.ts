import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'

type HeadersLike = {
  get(name: string): string | null
}

const SESSION_FILE = join(homedir(), '.seo-agent', 'session.json')

type SessionData = {
  cookie: string
  updatedAt: string
}

const ensureDir = (filePath: string) => {
  const dir = dirname(filePath)
  mkdirSync(dir, { recursive: true })
}

export const getSessionCookie = (): string | null => {
  try {
    const raw = readFileSync(SESSION_FILE, 'utf8')
    const data = JSON.parse(raw) as SessionData
    return typeof data.cookie === 'string' && data.cookie.length > 0 ? data.cookie : null
  } catch {
    return null
  }
}

export const saveSessionCookie = (cookie: string) => {
  ensureDir(SESSION_FILE)
  const data: SessionData = {
    cookie,
    updatedAt: new Date().toISOString()
  }
  writeFileSync(SESSION_FILE, JSON.stringify(data, null, 2), 'utf8')
}

const SESSION_COOKIE_NAME = 'session'

const parseSessionFromSetCookie = (header: string): string | null => {
  const entries = header
    .split(/,(?=[^;]+=[^;]+)/)
    .map((entry) => entry.trim())
    .filter(Boolean)

  for (const entry of entries) {
    if (!entry.toLowerCase().startsWith(`${SESSION_COOKIE_NAME}=`)) {
      continue
    }
    const [cookiePair] = entry.split(';')
    return cookiePair.trim()
  }

  return null
}

export const persistSessionFromHeaders = (headers: HeadersLike) => {
  const setCookie = headers.get('set-cookie')
  if (!setCookie) return
  const sessionCookie = parseSessionFromSetCookie(setCookie)
  if (sessionCookie) {
    saveSessionCookie(sessionCookie)
  }
}
