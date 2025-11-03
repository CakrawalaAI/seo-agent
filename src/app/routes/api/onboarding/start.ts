// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { httpError, json, safeHandler } from '@app/api-utils'
import { session } from '@common/infra/session'
import { requireSession } from '@app/api-utils'
import { buildGoogleAuthUrl, GoogleOAuthConfigError } from '@common/auth/google'
import { ensureProjectForOrg } from '@features/onboarding/server/ensure-project'
import { normalizeSiteInput } from '@features/onboarding/shared/url'
import { verifySiteReachable } from '@features/onboarding/server/reachability'

export const Route = createFileRoute('/api/onboarding/start')({
  server: {
    handlers: {
      POST: safeHandler(async ({ request }) => {
        const body = await request.json().catch(() => ({}))
        const rawSiteUrl = typeof body?.siteUrl === 'string' ? body.siteUrl : ''
        if (process.env.NODE_ENV !== 'production') {
          console.info('[onboarding.api.start] received', { rawSiteUrl })
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
          console.info('[onboarding.api.start] reachability', { siteUrl: normalized.siteUrl, reach })
        }
        if (!reach.ok) {
          return httpError(400, 'Site unreachable', { status: reach.status, error: reach.error })
        }
        const currentSession = session.read(request)
        if (process.env.NODE_ENV !== 'production') {
          console.info('[onboarding.api.start] session.read', {
            hasSession: Boolean(currentSession?.user),
            activeOrg: currentSession?.activeOrg?.id ?? null,
            activeProjectId: currentSession?.activeProjectId ?? null
          })
        }
        if (!currentSession?.user) {
          let authUrl: string
          let cookie: string
          const ensureSearch = new URLSearchParams({ site: normalized.siteUrl })
          const ensurePath = `/onboarding/ensure?${ensureSearch.toString()}`
          try {
            const result = buildGoogleAuthUrl(request, {
              redirectTo: ensurePath,
              payload: { onboarding: { siteUrl: normalized.siteUrl } }
            })
            authUrl = result.url
            cookie = result.cookie
          } catch (error) {
            if (error instanceof GoogleOAuthConfigError) {
              console.error('[onboarding.api.start] missing Google OAuth client configuration')
              return httpError(500, 'Google OAuth not configured')
            }
            throw error
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
        const result = await ensureProjectForOrg(orgId, normalized.siteUrl, {
          projectName: normalized.projectName
        })
        if (process.env.NODE_ENV !== 'production') {
          console.info('[onboarding.api.start] ensureProjectForOrg', {
            orgId,
            existed: result.existed,
            projectId: result.project.id,
            crawlJobId: result.crawlJobId ?? null
          })
        }
        const payload = {
          ...currentSession,
          activeOrg: sess.activeOrg ?? currentSession.activeOrg ?? { id: orgId },
          activeProjectId: result.project.id
        }
        const cookie = session.set(payload)
        const redirectTarget = result.existed
          ? '/dashboard'
          : `/onboarding?project=${encodeURIComponent(normalized.slug)}&projectId=${encodeURIComponent(result.project.id)}`
        return json(
          {
            status: result.existed ? 'existing' : 'created',
            projectId: result.project.id,
            projectSlug: normalized.slug,
            crawlJobId: result.crawlJobId ?? null,
            redirect: redirectTarget
          },
          { headers: { 'set-cookie': cookie } }
        )
      })
    }
  }
})
