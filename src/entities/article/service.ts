import { fetchJson, patchJson, postJson } from '@common/http/json'
import type { Article, ArticleOutlineSection, PublishArticleResult } from '@entities'

export type UpdateArticlePayload = {
  title: string
  language: string
  tone?: string
  bodyHtml: string
  outlineJson: ArticleOutlineSection[]
}

export function getArticle(articleId: string) {
  return fetchJson<Article>(`/api/articles/${articleId}`)
}

export function getWebsiteSnapshot(websiteId: string) {
  return fetchJson<any>(`/api/websites/${websiteId}/snapshot`)
}

export function updateArticle(articleId: string, payload: UpdateArticlePayload) {
  return patchJson<Article>(`/api/articles/${articleId}`, payload)
}

export function publishArticle(articleId: string, integrationId: string) {
  return postJson<PublishArticleResult>(`/api/articles/${articleId}/publish`, { integrationId })
}
