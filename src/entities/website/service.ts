import { fetchJson, postJson, putJson, patchJson, deleteJson, type JsonFetchOptions } from '@common/http/json'
import type { Article } from '@entities/article/domain/article'
import type { Website } from './domain/website'

export function getWebsite(websiteId: string, init?: JsonFetchOptions) {
  return fetchJson<Website>(`/api/websites/${websiteId}`, init)
}

export function listWebsites(orgId?: string, limit = 50) {
  const params = new URLSearchParams({ limit: String(limit) })
  if (orgId) params.set('orgId', orgId)
  return fetchJson<{ items: Website[] }>(`/api/websites?${params.toString()}`)
}

export function getWebsiteSnapshot(websiteId: string, init?: JsonFetchOptions) {
  return fetchJson<any>(`/api/websites/${websiteId}/snapshot`, init)
}

export function runSchedule(websiteId: string) {
  return postJson<{ result?: { queuedGenerations?: number; queuedPublishes?: number } }>(`/api/schedules/run`, { websiteId })
}

export function reschedulePlanItem(planItemId: string, scheduledDate: string) {
  return putJson<{ scheduledDate?: string }>(`/api/plan-items/${planItemId}`, { scheduledDate })
}

export function publishArticle(articleId: string, integrationId: string) {
  return postJson<{ jobId?: string }>(`/api/articles/${articleId}/publish`, { integrationId })
}

export function getWebsiteKeywords(websiteId: string, limit = 100) {
  return fetchJson<{ items: any[] }>(`/api/websites/${websiteId}/keywords?limit=${limit}`)
}

export function getWebsiteArticles(websiteId: string, limit = 90) {
  return fetchJson<{ items: any[] }>(`/api/websites/${websiteId}/articles?limit=${limit}`)
}

export function getPlanItems(websiteId: string, limit = 90) {
  return fetchJson<{ items: any[] }>(`/api/plan-items?websiteId=${websiteId}&limit=${limit}`)
}
