import { safeHandler, requireSession } from '@app/api-utils'
import { session } from '@common/infra/session'
import { ensureWebsiteForOrg } from '@features/onboarding/server/ensure-website'
import { normalizeSiteInput } from '@features/onboarding/shared/url'

function redirectResponse(to: string, cookie?: string) {
  const headers = new Headers()
  headers.set('Location', to)
  if (cookie) headers.append('Set-Cookie', cookie)
  return new Response(null, { status: 302, headers })
}

export const dashboardEnsureServer = {
  handlers: {
    GET: safeHandler(async ({ request }) => {
      const url = new URL(request.url)
      const rawSite = url.searchParams.get('site') ?? url.searchParams.get('url') ?? null
      const flowId = url.searchParams.get('flow')
      const slugParam = url.searchParams.get('slug') ?? null
      const projectIdParam = url.searchParams.get('websiteId') ?? url.searchParams.get('projectId') ?? null
      const nameParam = url.searchParams.get('name') ?? null
      const current = session.read(request)

      if (!current?.user) {
        return redirectResponse(`/`)
      }

      let activeOrgId = current.activeOrg?.id ?? null
      if (!activeOrgId) {
        try {
          const sess = await requireSession(request)
          activeOrgId = sess.activeOrg?.id ?? null
        } catch (error) {
          if (error instanceof Response) return error
          throw error
        }
      }

      if (!activeOrgId) {
        if (process.env.NODE_ENV !== 'production') {
          ;(await import('@src/common/logger')).log.debug('[dashboard.ensure] no_active_org', { flowId })
        }
        return redirectResponse('/dashboard')
      }

      if (projectIdParam) {
        const search = new URLSearchParams({ websiteId: projectIdParam })
        if (slugParam) search.set('website', slugParam)
        if (flowId) search.set('flow', flowId)
        const payload = {
          ...current,
          activeOrg: current.activeOrg ?? { id: activeOrgId },
          activeProjectId: projectIdParam,
          activeWebsiteId: projectIdParam
        }
        const cookie = session.set(payload)
        return redirectResponse(`/dashboard?${search.toString()}`, cookie)
      }

      if (!rawSite) {
        if (process.env.NODE_ENV !== 'production') {
          ;(await import('@src/common/logger')).log.debug('[dashboard.ensure] ensure_begin', { flowId, rawSite })
        }
        return redirectResponse('/dashboard')
      }

      let normalized
      try {
        normalized = normalizeSiteInput(rawSite)
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          ;(await import('@src/common/logger')).log.warn('[dashboard.ensure] invalid site', {
            rawSite,
            message: (error as Error)?.message ?? String(error)
          })
        }
        return redirectResponse('/dashboard')
      }

      const ensure = await ensureWebsiteForOrg(activeOrgId, normalized.siteUrl, { websiteName: nameParam || normalized.projectName })

      const search = new URLSearchParams({ websiteId: ensure.website.id, website: ensure.website.id })
      if (flowId) search.set('flow', flowId)
      const payload = {
        ...current,
        activeOrg: current.activeOrg ?? { id: activeOrgId },
        activeProjectId: ensure.website.id,
        activeWebsiteId: ensure.website.id
      }
      const cookie = session.set(payload)

      if (process.env.NODE_ENV !== 'production') {
        const logger = (await import('@src/common/logger')).log
        logger.debug('[dashboard.ensure] ensured', {
          flowId,
          websiteId: ensure.website.id,
          slug: slugParam || normalized.slug,
          existed: ensure.existed
        })
        logger.debug('[dashboard.ensure] redirect_dashboard', { flowId, websiteId: ensure.website.id })
      }

      return redirectResponse(`/dashboard?${search.toString()}`, cookie)
    })
  }
}
