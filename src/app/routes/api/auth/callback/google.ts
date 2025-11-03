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
import { hasDatabase, getDb } from '@common/infra/db'
import { session } from '@common/infra/session'
import { orgs, orgMembers } from '@entities/org/db/schema'
import { eq } from 'drizzle-orm'
import { projectsRepo } from '@entities/project/repository'
import { normalizeSiteInput } from '@features/onboarding/shared/url'

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

        if ((process.env.SEOA_AUTH_DEBUG || '') === '1') {
          console.info('[auth/callback/google:start]', {
            url: request.url,
            hasTempCookie: Boolean(parseTempCookie(request)?.state),
          })
        }
        let tokens
        try {
          tokens = await exchangeCodeForTokens(request, code)
        } catch (error) {
          if (error instanceof GoogleOAuthConfigError) {
            console.error('[auth/callback/google] missing Google OAuth credentials for token exchange')
            return httpError(500, 'Google OAuth not configured')
          }
          throw error
        }
        const profile = await fetchGoogleUser(tokens.access_token)
        const { userId } = await upsertUserFromGoogle({ sub: profile.sub, email: profile.email, name: profile.name, picture: profile.picture ?? null })

        let activeOrg: { id: string; plan?: string } | undefined
        if (hasDatabase()) {
          try {
            const db = getDb()
            // Check existing memberships
            const membs = (await db
              .select()
              .from(orgMembers)
              .where(eq(orgMembers.userEmail, profile.email))
              .limit(25)) as any
            if (!Array.isArray(membs) || membs.length === 0) {
              // Auto-create org and membership on first login
              const orgId = `org_${crypto.randomBytes(6).toString('hex')}`
              const orgName = `${(profile.email || 'org').split('@')[0]}'s Org`
              const trialEnt = { monthlyPostCredits: 1 }
              await db.insert(orgs).values({ id: orgId, name: orgName, plan: 'starter', entitlementsJson: trialEnt as any }).onConflictDoNothing()
              await db.insert(orgMembers).values({ orgId, userEmail: profile.email, role: 'owner' }).onConflictDoNothing?.()
              activeOrg = { id: orgId, plan: 'starter' }
            } else {
              const ids = new Set<string>(membs.map((m: any) => String(m.orgId)))
              const all = (await db.select().from(orgs).limit(50)) as any
              const joined = all.filter((o: any) => ids.has(String(o.id)))
              if (joined.length) activeOrg = { id: joined[0]!.id, plan: joined[0]!.plan }
            }
          } catch {}
        }

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
            if (typeof meta.projectName === 'string' && meta.projectName) {
              ensureSearch.set('name', meta.projectName)
            }
            redirectOverride = `/onboarding/ensure?${ensureSearch.toString()}`
          } catch (error) {
            console.error('[auth/callback/google] failed to prepare ensure redirect', {
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
        if ((process.env.SEOA_AUTH_DEBUG || '') === '1') {
          console.info('[auth/callback/google:session-set]', {
            email: profile.email,
            redirectTo,
            cookiePreview: String(cookie).slice(0, 48) + '...'
          })
        }
        // org_usage removed; no usage row required
        // Clear legacy Better Auth cookies if present
        headers.append('Set-Cookie', clearName('better-auth.session_token'))
        headers.append('Set-Cookie', clearName('better-auth.state'))
        headers.append('Set-Cookie', clearName('seo-agent-session'))
        const resp = new Response(null, { status: 302, headers })
        if ((process.env.SEOA_AUTH_DEBUG || '') === '1') {
          console.info('[auth/callback/google:done]', { status: resp.status, headers: { location: headers.get('Location') } })
        }
        return resp
      }),
    },
  },
})

function clearName(name: string) {
  return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
}
