import { createFileRoute, redirect } from '@tanstack/react-router'
import { Page } from '@pages/integrations/webhook/page'

export const Route = createFileRoute('/integrations/webhook')({
  beforeLoad: async ({ location }) => {
    try {
      const res = await fetch('/api/me', {
        headers: { accept: 'application/json' },
        credentials: 'include'
      })
      const data = res.ok ? await res.json() : null
      if (!data?.user) {
        throw redirect({ to: '/login', search: { redirect: location.href || '/integrations/webhook' } })
      }
      const projectParam = new URL(location.href).searchParams.get('project')
      if (projectParam) {
        try {
          const projectsResponse = await fetch('/api/projects?limit=200', {
            headers: { accept: 'application/json' },
            credentials: 'include'
          })
          if (projectsResponse.ok) {
            const body = await projectsResponse.json()
            const match = findProjectBySearchValue(body?.items ?? [], projectParam)
            if (match) {
              await fetch('/api/active-project', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ projectId: match.id })
              })
            }
          }
        } catch {}
      }
    } catch {
      throw redirect({ to: '/login', search: { redirect: '/integrations/webhook' } })
    }
  },
  component: Page
})

function findProjectBySearchValue(projects: Array<Record<string, any>>, input: string) {
  const normalized = normalizeValue(input)
  for (const project of projects) {
    if (normalizeValue(project?.id) === normalized) return project
    const siteUrl = project?.siteUrl ?? project?.site_url
    if (siteUrl && normalizeValue(siteUrl) === normalized) return project
  }
  return null
}

function normalizeValue(value?: string | null) {
  if (!value) return ''
  const trimmed = value.trim()
  if (!trimmed) return ''
  try {
    const url = new URL(trimmed)
    return `${url.protocol}//${url.host}`.replace(/\/$/, '')
  } catch {
    return trimmed.replace(/\/$/, '')
  }
}
