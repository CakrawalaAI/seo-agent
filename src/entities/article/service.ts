import { fetchJson, patchJson, postJson, deleteJson } from '@common/http/json'
import type { Article, ArticleAttachment, ArticleOutlineSection, PublishArticleResult } from '@entities'

export type UpdateArticlePayload = {
  title: string
  language: string
  tone?: string
  bodyHtml: string
  outlineJson: ArticleOutlineSection[]
}

export type ArticleDetail = {
  article: Article
  attachments: ArticleAttachment[]
}

export type ArticleMediaUploadResponse = {
  kind: 'upload'
  uploadUrl: string
  storageKey: string
  publicUrl: string
  expiresAt: number
  isRecommendedType?: boolean
}

export type ArticleMediaCompletePayload = {
  action: 'complete'
  type: 'image' | 'youtube' | 'file'
  storageKey: string
  url?: string
  caption?: string | null
}

export function getArticle(articleId: string) {
  return fetchJson<ArticleDetail>(`/api/articles/${articleId}`)
}

export function getWebsiteSnapshot(websiteId: string) {
  return fetchJson<any>(`/api/websites/${websiteId}/snapshot`)
}

export function updateArticle(articleId: string, payload: UpdateArticlePayload) {
  return patchJson<ArticleDetail>(`/api/articles/${articleId}`, payload)
}

export function publishArticle(articleId: string, integrationId: string) {
  return postJson<PublishArticleResult>(`/api/articles/${articleId}/publish`, { integrationId })
}

export function unpublishArticle(articleId: string) {
  return postJson<ArticleDetail>(`/api/articles/${articleId}/unpublish`, {})
}

export function deleteArticle(articleId: string) {
  return deleteJson<{ deleted: boolean }>(`/api/articles/${articleId}`)
}

export function requestArticleMediaUpload(articleId: string, payload: { action: 'upload'; filename: string; contentType?: string; contentLength?: number }) {
  return postJson<ArticleMediaUploadResponse>(`/api/articles/${articleId}/media`, payload)
}

export function completeArticleMedia(articleId: string, payload: ArticleMediaCompletePayload) {
  return postJson<{ kind: 'complete'; id: string; storageKey: string; url: string }>(`/api/articles/${articleId}/media`, payload)
}

export function deleteArticleMedia(articleId: string, attachmentId: string) {
  return postJson<{ kind: 'delete'; storageKey: string }>(`/api/articles/${articleId}/media`, {
    action: 'delete',
    attachmentId
  })
}
