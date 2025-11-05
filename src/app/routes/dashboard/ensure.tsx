import { createFileRoute, redirect, useNavigate, useSearch } from '@tanstack/react-router'

function EnsureComponent(): null {
  const search = useSearch({ from: '/dashboard/ensure' }) as { site?: string | null }
  const nav = useNavigate({ from: '/dashboard/ensure' })
  if (!search?.site && typeof window !== 'undefined') {
    try {
      const ls = window.localStorage.getItem('seo-agent.onboarding.siteUrl')
      if (ls && ls.trim().length) {
        nav({ to: '/dashboard/ensure', search: { site: ls }, replace: true })
      }
    } catch {}
  }
  return null
}

const routeConfig: any = {
  beforeLoad: async () => {
    try {
      const res = await fetch('/api/me', { headers: { accept: 'application/json' } })
      const data = res.ok ? await res.json() : null
      if (!data?.user) throw redirect({ to: '/' })
    } catch {
      throw redirect({ to: '/' })
    }
  },
  component: EnsureComponent
}

if (import.meta.env.SSR) {
  const { dashboardEnsureServer } = await import('@server/dashboardEnsureHandler')
  routeConfig.server = dashboardEnsureServer
}

export const Route = createFileRoute('/dashboard/ensure')(routeConfig)
