import { createServerFn } from '@tanstack/react-start'
import { getCookie } from '@tanstack/react-start-server'
import { session } from '@common/infra/session'

export type CurrentUser = { email: string; name?: string | null } | null

export const getCurrentUserFn = createServerFn({ method: 'GET' }).handler(async () => {
  if (process.env.E2E_NO_AUTH === '1') return { email: 'dev@example.com', name: 'Dev User' }
  const raw = getCookie('seoa_session')
  const s = session.decode(raw)
  if (!s?.user) return null
  return { email: s.user.email, name: s.user.name ?? null }
})

