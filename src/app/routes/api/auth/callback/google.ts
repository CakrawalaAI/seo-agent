// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import crypto from 'crypto'
import { httpError, safeHandler } from '@app/api-utils'
import {
  clearTempCookie,
  exchangeCodeForTokens,
  fetchGoogleUser,
  GoogleOAuthConfigError,
  parseTempCookie,
  sanitizeRedirect,
  upsertUserFromGoogle
} from '@common/auth/google'
import { getDb } from '@common/infra/db'
import { session } from '@common/infra/session'
import { organizations, organizationMembers } from '@entities/org/db/schema'
import { eq } from 'drizzle-orm'
import { normalizeSiteInput } from '@features/onboarding/shared/url'
import { log } from '@src/common/logger'

export const Route = createFileRoute('/api/auth/callback/google')({
  server: {
    handlers: {
      GET: safeHandler(async ({ request }) => {
        const url = new URL(request.url)
        const code = url.searchParams.get('code')
        const state = url.searchParams.get('state')
        if (!code || !state) return httpError(400, 'Missing code/state')
        const tmp = parseTempCookie(request)
        if (!tmp?.state || tmp.state !== state) return httpError(400, 'Invalid state')
        const redirectTo = sanitizeRedirect(tmp.redirectTo || '/dashboard')
        const payloadMeta = (tmp?.payload as any) ?? null

        // Debug logging removed (no flag)
        let tokens
        try {
          tokens = await exchangeCodeForTokens(request, code)
        } catch (error) {
          if (error instanceof GoogleOAuthConfigError) {
            log.error('[auth/callback/google] missing Google OAuth credentials for token exchange')
            return httpError(500, 'Google OAuth not configured')
          }
          throw error
        }
        const profile = await fetchGoogleUser(tokens.access_token)
        const { userId } = await upsertUserFromGoogle({ sub: profile.sub, email: profile.email, name: profile.name, picture: profile.picture ?? null })

        let activeOrg: { id: string; plan?: string } | undefined
        try {
          const db = getDb()
          // Check existing memberships
          const membs = (await db
            .select()
            .from(organizationMembers)
            .where(eq(organizationMembers.userEmail, profile.email))
            .limit(25)) as any
          if (!Array.isArray(membs) || membs.length === 0) {
            // Auto-create org and membership on first login
            const orgId = `org_${crypto.randomBytes(6).toString('hex')}`
            const orgName = `${(profile.email || 'org').split('@')[0]}'s Org`
            const trialEnt = { monthlyPostCredits: 1 }
            await db.insert(organizations).values({ id: orgId, name: orgName, plan: 'starter', entitlementsJson: trialEnt as any }).onConflictDoNothing()
            await db.insert(organizationMembers).values({ orgId, userEmail: profile.email, role: 'owner' }).onConflictDoNothing?.()
            activeOrg = { id: orgId, plan: 'starter' }
          } else {
            const ids = new Set<string>(membs.map((m: any) => String(m.orgId)))
            const all = (await db.select().from(organizations).limit(50)) as any
            const joined = all.filter((o: any) => ids.has(String(o.id)))
            if (joined.length) activeOrg = { id: joined[0]!.id, plan: joined[0]!.plan }
          }
        } catch {}

        let redirectOverride: string | null = null
        let activeProjectId: string | null = null
        if (payloadMeta?.onboarding?.siteUrl && activeOrg?.id) {
          try {
            const meta = payloadMeta.onboarding
            const normalized = normalizeSiteInput(meta.siteUrl)
            const slug = typeof meta.slug === 'string' && meta.slug ? meta.slug : normalized.slug
            const ensureSearch = new URLSearchParams({
              site: normalized.siteUrl,
              slug
            })
            if (meta.flow) ensureSearch.set('flow', String(meta.flow))
            if (typeof meta.projectName === 'string' && meta.projectName) {
              ensureSearch.set('name', meta.projectName)
            }
            redirectOverride = `/dashboard/ensure?${ensureSearch.toString()}`
          } catch (error) {
            log.error('[auth/callback/google] failed to prepare ensure redirect', {
              siteUrl: payloadMeta.onboarding?.siteUrl,
              error: (error as Error)?.message || String(error)
            })
          }
        }

        // If no onboarding payload, honor original redirect (default '/dashboard').

        const payload = {
          user: { email: profile.email, name: profile.name ?? null },
          activeOrg,
          activeProjectId
        }
        const cookie = session.set(payload)
        const headers = new Headers()
        headers.set('Location', redirectOverride ?? redirectTo)
        headers.append('Set-Cookie', cookie)
        headers.append('Set-Cookie', clearTempCookie())
        // Debug logging removed (no flag)
        // org_usage removed; no usage row required
        // Clear legacy Better Auth cookies if present
        headers.append('Set-Cookie', clearName('better-auth.session_token'))
        headers.append('Set-Cookie', clearName('better-auth.state'))
        headers.append('Set-Cookie', clearName('seo-agent-session'))
        if (process.env.NODE_ENV !== 'production') {
          log.debug('[auth/callback/google] oauth_callback', {
            email: profile.email,
            activeOrgId: activeOrg?.id ?? null,
            redirect: redirectOverride ?? redirectTo,
          })
        }
        const resp = new Response(null, { status: 302, headers })
        // Debug logging removed (no flag)
        return resp
      }),
    },
  },
})

function clearName(name: string) {
  return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
}
