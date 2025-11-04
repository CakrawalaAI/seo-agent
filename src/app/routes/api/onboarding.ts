// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { httpError, json, safeHandler } from '@app/api-utils'
import { session } from '@common/infra/session'
import { requireSession } from '@app/api-utils'
import { buildGoogleAuthUrl, GoogleOAuthConfigError, getBaseUrl } from '@common/auth/google'
import { ensureWebsiteForOrg } from '@features/onboarding/server/ensure-website'
import { normalizeSiteInput } from '@features/onboarding/shared/url'
import { verifySiteReachable } from '@features/onboarding/server/reachability'
import { log } from '@src/common/logger'

export const Route = createFileRoute('/api/onboarding')({
  server: {
    handlers: {
      POST: safeHandler(async ({ request }) => {
        const body = await request.json().catch(() => ({}))
        const rawSiteUrl = typeof body?.siteUrl === 'string' ? body.siteUrl : ''
        const flowId = (typeof body?.flowId === 'string' && body.flowId) || request.headers.get('x-seoa-flow') || null
        if (process.env.NODE_ENV !== 'production') {
          const envInfo = {
            appUrl: Boolean((process.env.APP_URL || '').trim()),
            googleId: Boolean((process.env.GOOGLE_CLIENT_ID || '').trim()),
            googleSecret: Boolean((process.env.GOOGLE_CLIENT_SECRET || '').trim()),
          }
          const baseUrl = (() => { try { return getBaseUrl(request) } catch { return '<err-baseurl>' } })()
          log.debug('[onboarding.api] received', { rawSiteUrl, flowId, env: envInfo, baseUrl })
        }
        if (!rawSiteUrl) return httpError(400, 'Missing siteUrl')
        let normalized
        try {
          normalized = normalizeSiteInput(rawSiteUrl)
        } catch {
          return httpError(400, 'Invalid site URL')
        }
        const reach = await verifySiteReachable(normalized.siteUrl)
        if (process.env.NODE_ENV !== 'production') {
          log.debug('[onboarding.api] reachability', { flowId, siteUrl: normalized.siteUrl, ok: reach.ok, status: reach.status })
        }
        if (!reach.ok) {
          return httpError(400, 'Site unreachable', { status: reach.status, error: reach.error })
        }
        const currentSession = session.read(request)
        if (process.env.NODE_ENV !== 'production') {
          log.info('[onboarding.api] session.read', {
            hasSession: Boolean(currentSession?.user),
            activeOrg: currentSession?.activeOrg?.id ?? null,
            activeProjectId: currentSession?.activeProjectId ?? null
          })
        }
        if (!currentSession?.user) {
          let authUrl: string
          let cookie: string
          const ensureSearch = new URLSearchParams({ site: normalized.siteUrl })
          if (flowId) ensureSearch.set('flow', flowId)
          const ensurePath = `/dashboard/ensure?${ensureSearch.toString()}`
          try {
            const result = buildGoogleAuthUrl(request, {
              redirectTo: ensurePath,
              payload: { onboarding: { siteUrl: normalized.siteUrl, flow: flowId || null } }
            })
            authUrl = result.url
            cookie = result.cookie
          } catch (error) {
            const name = (error as any)?.name
            if (error instanceof GoogleOAuthConfigError || name === 'GoogleOAuthConfigError') {
              log.error('[onboarding.api] missing Google OAuth client configuration')
              return httpError(500, 'Google OAuth not configured')
            }
            log.error('[onboarding.api] unexpected error building auth url', { message: (error as Error)?.message || String(error) })
            return httpError(500, 'Internal Server Error')
          }
          if (process.env.NODE_ENV !== 'production') {
            log.debug('[onboarding.api] unauth_redirect', { flowId, ensurePath })
          }
          return json(
            {
              status: 'auth',
              url: authUrl,
              redirect: ensurePath
            },
            { headers: { 'set-cookie': cookie } }
          )
        }
        let sess
        try {
          sess = await requireSession(request)
        } catch (error) {
          if (error instanceof Response) return error
          throw error
        }
        const orgId = sess.activeOrg?.id || currentSession.activeOrg?.id
        if (!orgId) {
          return httpError(400, 'Organization not selected')
        }
        const result = await ensureWebsiteForOrg(orgId, normalized.siteUrl, { websiteName: normalized.projectName })
        if (process.env.NODE_ENV !== 'production') {
          log.debug('[onboarding.api] ensured', {
            orgId,
            flowId,
            existed: result.existed,
            projectId: result.project?.id ?? result.website.id,
            crawlJobId: result.crawlJobId ?? null
          })
        }
        const payload = {
          ...currentSession,
          activeOrg: sess.activeOrg ?? currentSession.activeOrg ?? { id: orgId },
          activeWebsiteId: result.website.id,
          activeProjectId: result.website.id
        }
        const cookie = session.set(payload)
        const redirectTarget = `/dashboard?website=${encodeURIComponent(result.website.id)}`
        return json(
          {
            status: result.existed ? 'existing' : 'created',
            websiteId: result.website.id,
            websiteSlug: normalized.slug,
            crawlJobId: result.crawlJobId ?? null,
            redirect: redirectTarget
          },
          { headers: { 'set-cookie': cookie } }
        )
      })
    }
  }
})
