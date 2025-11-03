import { redirect } from '@tanstack/react-router'
import { fetchSession } from '@entities/org/service'
import { getProject, getProjectSnapshot, listProjects } from '@entities/project/service'
import type { Project } from '@entities'
import { normalizeSiteInput } from '@features/onboarding/shared/url'

type LoaderArgs = {
  context: { queryClient: any }
  search?: Record<string, unknown> | URLSearchParams
}

export async function loader({ context, search }: LoaderArgs) {
  const qc = context.queryClient
  if (typeof console !== 'undefined' && process.env.NODE_ENV !== 'production') {
    console.info('[onboarding.loader] start', { search: search instanceof URLSearchParams ? Object.fromEntries(search.entries()) : search })
  }
  const me = await qc.ensureQueryData({ queryKey: ['me'], queryFn: fetchSession })
  if (process.env.NODE_ENV !== 'production') {
    console.info('[onboarding.loader] session', {
      user: me?.user?.email ?? null,
      activeOrg: me?.activeOrg?.id ?? null,
      activeProjectId: me?.activeProjectId ?? null
    })
  }

  const params =
    search instanceof URLSearchParams
      ? search
      : new URLSearchParams(
          search && typeof search === 'object'
            ? Object.entries(search)
                .filter(([, value]) => value != null)
                .map(([key, value]) => [key, String(value)])
            : undefined
        )

  const rawSite = params.get('site')?.trim() || params.get('url')?.trim() || null
  let normalizedSite: { siteUrl: string; slug: string; projectName: string } | null = null
  if (rawSite) {
    try {
      normalizedSite = normalizeSiteInput(rawSite)
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[onboarding.loader] invalid site param', { rawSite, message: (error as Error)?.message ?? String(error) })
      }
    }
  }

  const queryProjectId = params.get('projectId')
  let projectId = queryProjectId && queryProjectId.trim().length ? queryProjectId : me?.activeProjectId ?? null
  let projectSlug = params.get('project') || params.get('slug') || normalizedSite?.slug || null

  if (!projectId && projectSlug && me?.activeOrg?.id) {
    try {
      const projectsResult = await qc.ensureQueryData({
        queryKey: ['projects', me.activeOrg.id],
        queryFn: () => listProjects(me.activeOrg!.id, 100)
      })
      const match = projectsResult?.items?.find((item: Project) => {
        if (!item?.siteUrl) return false
        try {
          return normalizeSiteInput(item.siteUrl).slug === projectSlug
        } catch {
          return false
        }
      }) ?? null
      if (match) {
        projectId = match.id
        if (!normalizedSite) {
          try {
            normalizedSite = normalizeSiteInput(match.siteUrl ?? '')
          } catch {}
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[onboarding.loader] failed project lookup by slug', {
          projectSlug,
          orgId: me?.activeOrg?.id ?? null,
          message: (error as Error)?.message ?? String(error)
        })
      }
    }
  }

  if (!projectId && normalizedSite?.siteUrl) {
    if (process.env.NODE_ENV !== 'production') {
      console.info('[onboarding.loader] redirecting to ensure route', {
        siteUrl: normalizedSite.siteUrl,
        projectSlug: normalizedSite.slug
      })
    }
    throw redirect({ to: '/onboarding/ensure', search: { site: normalizedSite.siteUrl } })
  }

  if (!projectId) {
    if (process.env.NODE_ENV !== 'production') {
      console.info('[onboarding.loader] no projectId', {
        projectSlug,
        normalizedSite: normalizedSite?.siteUrl ?? null,
        sessionHasUser: Boolean(me?.user)
      })
    }
    return { projectId: null, projectSlug, siteUrl: normalizedSite?.siteUrl ?? rawSite ?? null, session: me }
  }

  try {
    const projectPromise = qc.ensureQueryData({ queryKey: ['project', projectId], queryFn: () => getProject(projectId) })
    const snapshotPromise = qc.ensureQueryData({
      queryKey: ['projectSnapshot', projectId],
      queryFn: () => getProjectSnapshot(projectId, { cache: 'no-store' })
    })

    const [project] = await Promise.all([projectPromise, snapshotPromise])
    if (process.env.NODE_ENV !== 'production') {
      console.info('[onboarding.loader] fetched project', {
        projectId,
        siteUrl: project?.siteUrl ?? null
      })
    }

    if (!projectSlug && project?.siteUrl) {
      try {
        projectSlug = normalizeSiteInput(project.siteUrl).slug
      } catch {}
    }
    if (!normalizedSite?.siteUrl && project?.siteUrl) {
      try {
        normalizedSite = normalizeSiteInput(project.siteUrl)
      } catch {}
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[onboarding.loader] fallback without project data', {
        projectId,
        message: (error as Error)?.message ?? String(error)
      })
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    console.info('[onboarding.loader] returning', { projectId, projectSlug, siteUrl: normalizedSite?.siteUrl ?? null })
  }
  return { projectId, projectSlug, siteUrl: normalizedSite?.siteUrl ?? null, session: me }
}
