import { redirect } from '@tanstack/react-router'

export async function ensureIntegrationAccess(locationHref: string): Promise<void> {
  if (isE2EBypass()) {
    return
  }
  const res = await fetch('/api/me', {
    headers: { accept: 'application/json' },
    credentials: 'include'
  })
  const data = res.ok ? await res.json() : null
  if (!data?.user) {
    throw redirect({ to: '/' })
  }

  const url = new URL(locationHref)
  const projectParam = url.searchParams.get('website') ?? url.searchParams.get('project')
  if (!projectParam) return

  try {
    const projectsResponse = await fetch('/api/websites?limit=200', {
      headers: { accept: 'application/json' },
      credentials: 'include'
    })
    if (!projectsResponse.ok) return
    const body = await projectsResponse.json()
    const match = findProject(body?.items ?? [], projectParam)
    if (!match) return
    await fetch('/api/active-website', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ websiteId: match.id })
    })
  } catch {
    // ignore selection errors
  }
}

function isE2EBypass(): boolean {
  if (typeof process !== 'undefined' && process.env?.E2E_NO_AUTH === '1') {
    return true
  }
  if (typeof globalThis !== 'undefined' && (globalThis as any).__E2E_NO_AUTH__ === '1') {
    return true
  }
  return false
}

function findProject(projects: Array<Record<string, any>>, raw: string) {
  const normalized = normalize(raw)
  for (const project of projects) {
    if (normalize(project?.id) === normalized) return project
    const siteUrl = project?.url ?? project?.siteUrl ?? project?.site_url
    if (normalize(siteUrl) === normalized) return project
  }
  return null
}

function normalize(value?: string | null) {
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
