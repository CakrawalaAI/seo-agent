import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/projects/$projectId/')({
  beforeLoad: async ({ location, params }) => {
    try {
      const res = await fetch('/api/me', { headers: { accept: 'application/json' } })
      const data = res.ok ? await res.json() : null
      if (!data?.user) throw redirect({ to: '/login', search: { redirect: location.href } })
    } catch {
      throw redirect({ to: '/login', search: { redirect: '/projects' } })
    }

    const basePath = `/projects/${params.projectId}`
    if (location.pathname === basePath || location.pathname === `${basePath}/`) {
      throw redirect({
        to: '/onboarding',
        search: { projectId: params.projectId }
      })
    }
  }
})
