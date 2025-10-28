import {
  fetchJson,
  postJson,
  putJson,
  patchJson,
  type JsonFetchOptions
} from '@common/http/json'
import type {
  Article,
  CrawlPage,
  Keyword,
  PlanItem,
  Project,
  ProjectIntegration,
  ProjectSnapshot
} from '@entities'

export function getProject(projectId: string, init?: JsonFetchOptions) {
  return fetchJson<Project>(`/api/projects/${projectId}`, init)
}

export function listProjects(orgId?: string, limit = 50) {
  const params = new URLSearchParams({ limit: String(limit) })
  if (orgId) params.set('orgId', orgId)
  return fetchJson<{ items: Project[] }>(`/api/projects?${params.toString()}`)
}

export function createProject(input: {
  orgId: string
  name: string
  siteUrl: string
  defaultLocale: string
}) {
  return postJson<{ project: Project; crawlJobId?: string | null }>(`/api/projects`, input)
}

export function getProjectSnapshot(projectId: string, init?: JsonFetchOptions) {
  return fetchJson<ProjectSnapshot>(`/api/projects/${projectId}/snapshot`, init)
}

export function getCrawlPages(projectId: string, limit = 100) {
  return fetchJson<{ items: CrawlPage[] }>(`/api/crawl/pages?projectId=${projectId}&limit=${limit}`)
}

export function getProjectKeywords(projectId: string, limit = 100) {
  return fetchJson<{ items: Keyword[] }>(`/api/projects/${projectId}/keywords?limit=${limit}`)
}

export function getPlanItems(projectId: string, limit = 90) {
  return fetchJson<{ items: PlanItem[] }>(`/api/plan-items?projectId=${projectId}&limit=${limit}`)
}

export function getProjectArticles(projectId: string, limit = 90) {
  return fetchJson<{ items: Article[] }>(`/api/projects/${projectId}/articles?limit=${limit}`)
}

export function runCrawl(projectId: string) {
  return postJson<{ jobId?: string }>(`/api/crawl/run`, { projectId })
}

export function generateKeywords(projectId: string, locale: string) {
  return postJson<{ jobId?: string }>(`/api/keywords/generate`, { projectId, locale })
}

export function createPlan(projectId: string, days: number) {
  return postJson<{ jobId?: string }>(`/api/plan-items`, { projectId, days })
}

export function runSchedule(projectId: string) {
  return postJson<{ result?: { publishedArticles?: number; generatedDrafts?: number } }>(
    `/api/schedules/run`,
    { projectId }
  )
}

export function reschedulePlanItem(planItemId: string, plannedDate: string) {
  return putJson<{ plannedDate?: string }>(`/api/plan-items/${planItemId}`, { plannedDate })
}

export function publishArticle(articleId: string, integrationId: string) {
  return postJson<{ jobId?: string }>(`/api/articles/${articleId}/publish`, { integrationId })
}

export function testIntegration(integrationId: string) {
  return postJson(`/api/integrations/${integrationId}/test`, {})
}

export function createWebhook(projectId: string, targetUrl: string, secret: string) {
  return postJson<ProjectIntegration>(`/api/integrations`, {
    projectId,
    type: 'webhook',
    config: { targetUrl, secret },
    status: 'connected'
  })
}

export function patchProject(projectId: string, payload: Record<string, unknown>) {
  return patchJson<Project>(`/api/projects/${projectId}`, payload)
}
