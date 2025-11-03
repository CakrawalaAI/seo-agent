import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { loader } from '@pages/onboarding/loader'
import { Page } from '@pages/onboarding/page'
import { getCurrentUserFn } from '@server/auth'
import type { MeSession } from '@entities'

export const Route = createFileRoute('/onboarding')({
  beforeLoad: async ({ location }) => {
    const user = await getCurrentUserFn()
    if (!user) {
      throw redirect({ to: '/login', search: { redirect: location.href || '/onboarding' } })
    }
  },
  loader,
  component: () => {
    const data = Route.useLoaderData() as {
      projectId: string | null
      projectSlug: string | null
      siteUrl: string | null
      session: MeSession | null
    }
    const search = Route.useSearch() as { projectId?: string; project?: string; site?: string; slug?: string }
    const navigate = useNavigate()

    useEffect(() => {
      if (!data.projectId) return
      const hasProjectId = search?.projectId === data.projectId
      const hasSlug = data.projectSlug ? search?.project === data.projectSlug : true
      if (hasProjectId && hasSlug) return
      navigate({
        to: '/onboarding',
        search: (prev: Record<string, unknown> | undefined) => ({
          ...(prev ?? {}),
          projectId: data.projectId,
          ...(data.projectSlug ? { project: data.projectSlug } : {})
        }),
        replace: true
      })
    }, [data.projectId, data.projectSlug, navigate, search])

    const fallbackProjectId = data.projectId ?? (search?.projectId ? String(search.projectId) : null)
    const fallbackSlug = data.projectSlug ?? (search?.project ? String(search.project) : search?.slug ? String(search.slug) : null)
    const fallbackSite = data.siteUrl ?? (search?.site ? String(search.site) : null)

    return <Page projectId={fallbackProjectId} projectSlug={fallbackSlug} siteUrl={fallbackSite} session={data.session} />
  }
})
