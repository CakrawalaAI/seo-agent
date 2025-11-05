import { redirect } from '@tanstack/react-router'
import { fetchSession } from '@entities/org/service'
import { fetchJson, postJson } from '@common/http/json'

export async function ensureIntegrationAccess(locationHref: string): Promise<void> {
  if (isE2EBypass()) {
    return
  }
  const data = await fetchSession().catch(() => null)
  if (!data?.user) {
    throw redirect({ to: '/' })
  }

  const url = new URL(locationHref)
  const projectParam = url.searchParams.get('website') ?? url.searchParams.get('project')
  if (!projectParam) return

  try {
    const body = await fetchJson<{ items?: Array<Record<string, any>> }>('/api/websites?limit=200').catch(() => null)
    if (!body?.items?.length) return
    const match = findProject(body.items, projectParam)
    if (!match) return
    await postJson('/api/active-website', { websiteId: match.id }).catch(() => null)
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
