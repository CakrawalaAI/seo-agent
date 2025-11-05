import type { Article } from '@entities/article/domain/article'

export type PortableArticle = {
  title?: string | null
  excerpt?: string | null
  bodyHtml?: string | null
  outline?: Array<{ level: number; text: string }>
  seo?: { metaTitle?: string; metaDescription?: string; primaryKeyword?: string; jsonLd?: any }
  locale?: string | null
  slug?: string | null
}

export async function publishViaWebhook(options: {
  article: Article
  targetUrl: string
  secret?: string | null
  event?: 'article.published' | 'article.updated' | 'test.ping'
  eventId?: string
  meta?: { integrationId: string; projectId: string; articleId?: string | null }
}): Promise<{ externalId?: string; url?: string; status: number; sentHeaders: Record<string, string>; responseBody?: string } | null> {
  const payload: PortableArticle = buildPortable(options.article)
  const envelope = {
    id: options.eventId || options.article.id,
    event: options.event || 'article.published',
    created_at: new Date().toISOString(),
    meta: options.meta ?? { integrationId: 'unknown', projectId: String((options.article as any).websiteId || 'unknown'), articleId: options.article.id },
    article: payload
  }
  const body = JSON.stringify(envelope)
  const ts = Math.floor(Date.now() / 1000)
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'X-SEOA-Idempotency': String(envelope.id),
    'X-SEOA-Event': String(envelope.event),
    'X-SEOA-Timestamp': String(ts),
    'X-SEOA-Version': '2025-11-01'
  }
  if (options.secret) {
    headers['X-SEOA-Signature'] = signHmacSha256(`${ts}.${body}`, options.secret)
  }
  try {
    const res = await fetch(options.targetUrl, { method: 'POST', headers, body })
    const text = await res.text().catch(() => '')
    if (!res.ok) {
      return { status: res.status, sentHeaders: headers, responseBody: text }
    }
    let data: any = null
    try { data = JSON.parse(text) } catch {}
    return { externalId: data?.externalId, url: data?.url, status: res.status, sentHeaders: headers, responseBody: text }
  } catch {
    return null
  }
}

function buildPortable(article: Article): PortableArticle {
  const outline = (article.outlineJson ?? []).map((s) => ({ level: 2, text: s.heading }))
  // JSON-LD preview (optional, no URL resolution)
  let jsonLd: any = undefined
  try {
    const { buildArticleJsonLd } = require('../seo/jsonld') as typeof import('../seo/jsonld')
    jsonLd = buildArticleJsonLd(article)
  } catch {}
  return {
    title: article.title ?? '',
    bodyHtml: article.bodyHtml ?? '',
    outline,
    seo: { metaTitle: article.title ?? undefined, jsonLd },
    locale: article.language ?? 'en'
  }
}

function signHmacSha256(body: string, secret: string) {
  // node:crypto is not available in browser runtime but in server route this is fine.
  try {
    const crypto = require('node:crypto') as typeof import('node:crypto')
    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(body)
    return `sha256=${hmac.digest('hex')}`
  } catch {
    return ''
  }
}
