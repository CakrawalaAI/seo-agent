import type { Article } from '@entities/article/domain/article'

export type PortableArticle = {
  title?: string | null
  excerpt?: string | null
  bodyHtml?: string | null
  outline?: Array<{ level: number; text: string }>
  seo?: { metaTitle?: string; metaDescription?: string; primaryKeyword?: string }
  locale?: string | null
  slug?: string | null
}

export async function publishViaWebhook(options: {
  article: Article
  targetUrl: string
  secret?: string | null
}): Promise<{ externalId?: string; url?: string } | null> {
  const payload: PortableArticle = buildPortable(options.article)
  const body = JSON.stringify(payload)
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'X-SEOA-Idempotency': options.article.id
  }
  if (options.secret) {
    headers['X-SEOA-Signature'] = signHmacSha256(body, options.secret)
  }
  const res = await fetch(options.targetUrl, { method: 'POST', headers, body })
  if (!res.ok) return null
  try {
    const data = (await res.json()) as { externalId?: string; url?: string }
    return data ?? null
  } catch {
    return null
  }
}

function buildPortable(article: Article): PortableArticle {
  const outline = (article.outlineJson ?? []).map((s) => ({ level: 2, text: s.heading }))
  return {
    title: article.title ?? '',
    bodyHtml: article.bodyHtml ?? '',
    outline,
    seo: { metaTitle: article.title ?? undefined },
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
