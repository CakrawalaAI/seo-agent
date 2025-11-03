import { createFileRoute } from '@tanstack/react-router'
import { safeHandler } from '@app/api-utils'
import { requireSession } from '@app/api-utils'
import { session } from '@common/infra/session'
import { ensureProjectForOrg } from '@features/onboarding/server/ensure-project'
import { normalizeSiteInput } from '@features/onboarding/shared/url'

function redirectResponse(to: string, cookie?: string) {
  const headers = new Headers()
  headers.set('Location', to)
  if (cookie) headers.append('Set-Cookie', cookie)
  return new Response(null, { status: 302, headers })
}

export const Route = createFileRoute('/onboarding/ensure')({
  server: {
    handlers: {
      GET: safeHandler(async ({ request }) => {
        const url = new URL(request.url)
        const rawSite = url.searchParams.get('site') ?? url.searchParams.get('url') ?? null
        const slugParam = url.searchParams.get('slug') ?? null
        const projectIdParam = url.searchParams.get('projectId') ?? null
        const nameParam = url.searchParams.get('name') ?? null
        const current = session.read(request)
        const loginRedirect = `/onboarding/ensure${rawSite ? `?site=${encodeURIComponent(rawSite)}${slugParam ? `&slug=${encodeURIComponent(slugParam)}` : ''}` : ''}`

        if (!current?.user) {
          return redirectResponse(`/login?redirect=${encodeURIComponent(loginRedirect)}`)
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
          return redirectResponse('/onboarding')
        }

        if (projectIdParam) {
          const search = new URLSearchParams({ projectId: projectIdParam })
          if (slugParam) search.set('project', slugParam)
          const payload = {
            ...current,
            activeOrg: current.activeOrg ?? { id: activeOrgId },
            activeProjectId: projectIdParam
          }
          const cookie = session.set(payload)
          return redirectResponse(`/onboarding?${search.toString()}`, cookie)
        }

        if (!rawSite) {
          return redirectResponse('/onboarding')
        }

        let normalized
        try {
          normalized = normalizeSiteInput(rawSite)
        } catch (error) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn('[onboarding.ensure] invalid site', {
              rawSite,
              message: (error as Error)?.message ?? String(error)
            })
          }
          return redirectResponse('/onboarding')
        }

        const ensure = await ensureProjectForOrg(activeOrgId, normalized.siteUrl, {
          projectName: nameParam || normalized.projectName
        })

        const slug = slugParam || normalized.slug
        const search = new URLSearchParams({
          projectId: ensure.project.id,
          project: slug
        })
        const payload = {
          ...current,
          activeOrg: current.activeOrg ?? { id: activeOrgId },
          activeProjectId: ensure.project.id
        }
        const cookie = session.set(payload)

        if (process.env.NODE_ENV !== 'production') {
          console.info('[onboarding.ensure] ensured project', {
            projectId: ensure.project.id,
            slug,
            existed: ensure.existed
          })
        }

        return redirectResponse(`/onboarding?${search.toString()}`, cookie)
      })
    }
  }
  ,
  component: () => {
    // Client bridge: if site is missing (e.g., refresh), try localStorage
    const search = Route.useSearch() as { site?: string | null }
    const nav = Route.useNavigate()
    if (!search?.site && typeof window !== 'undefined') {
      try {
        const ls = window.localStorage.getItem('seo-agent.onboarding.siteUrl')
        if (ls && ls.trim().length) {
          nav({ to: '/onboarding/ensure', search: { site: ls }, replace: true })
        }
      } catch {}
    }
    return null
  }
})
