// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession, requireWebsiteAccess } from '@app/api-utils'
import { articlesRepo } from '@entities/article/repository'
import { attachmentsRepo } from '@entities/article/repository.attachments'
import { hasDatabase, getDb } from '@common/infra/db'
import { articles } from '@entities/article/db/schema'
import { eq } from 'drizzle-orm'

export const Route = createFileRoute('/api/articles/$articleId/')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        await requireSession(request)
        const article = await articlesRepo.get(params.articleId)
        if (!article) {
          if (hasDatabase()) {
            try {
              const db = getDb()
              const rows = await (db.select().from(articles).where(eq(articles.id, params.articleId)).limit(1) as any)
              const found = rows?.[0]
              if (found) {
                await requireWebsiteAccess(request, String((found as any).websiteId || (found as any).projectId))
                const attachments = await attachmentsRepo.listByArticle(params.articleId)
                return json({ article: found, attachments })
              }
            } catch {}
          }
          return httpError(404, 'Not found')
        }
        await requireWebsiteAccess(request, String((article as any).websiteId))
        const attachments = await attachmentsRepo.listByArticle(params.articleId)
        return json({ article, attachments })
      },
      PATCH: safeHandler(async ({ params, request }) => {
        const patch = await request.json().catch(() => ({}))
        if (typeof patch?.bodyHtml === 'string') {
          patch.bodyHtml = sanitizeBodyHtml(patch.bodyHtml, String(patch?.title || ''))
        }
        const current = await articlesRepo.get(params.articleId)
        if (!current) return httpError(404, 'Not found')
        // Guard against accidental overwrites with near-empty content (e.g., client autosave before generation completes)
        const strip = (html?: string | null) => String(html || '').replace(/<!DOCTYPE[\s\S]*?>/gi, '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        const minLen = 30
        if (typeof patch.bodyHtml === 'string') {
          const incomingLen = strip(patch.bodyHtml).length
          const existingLen = Math.max(strip((current as any).bodyHtml).length, strip((current as any)?.payloadJson?.bodyHtml).length)
          if (incomingLen < minLen && existingLen >= minLen) {
            // Drop bodyHtml from patch to preserve substantive existing content
            delete (patch as any).bodyHtml
          }
        }
        await requireWebsiteAccess(request, String((current as any).websiteId))
        if (hasDatabase()) {
          try {
            const db = getDb()
            await db.update(articles).set({ ...patch, updatedAt: new Date() as any }).where(eq(articles.id, params.articleId))
          } catch {}
        }
        const updated = await articlesRepo.update(params.articleId, patch)
        if (!updated) return httpError(404, 'Not found')
        const attachments = await attachmentsRepo.listByArticle(params.articleId)
        return json({ article: updated, attachments })
      }),
      DELETE: safeHandler(async ({ params, request }) => {
        const article = await articlesRepo.get(params.articleId)
        let websiteId = article ? String((article as any).websiteId ?? (article as any).projectId ?? '') : ''
        if (!websiteId && hasDatabase()) {
          try {
            const db = getDb()
            const rows = await (db.select().from(articles).where(eq(articles.id, params.articleId)).limit(1) as any)
            const found = rows?.[0]
            if (found) {
              websiteId = String((found as any).websiteId || (found as any).projectId || '')
            }
          } catch {}
        }
        if (!websiteId) return httpError(404, 'Not found')
        await requireWebsiteAccess(request, websiteId)
        await articlesRepo.remove(params.articleId)
        if (hasDatabase()) {
          try {
            const db = getDb()
            await db.delete(articles).where(eq(articles.id, params.articleId))
          } catch {}
        }
        return json({ deleted: true })
      })
    }
  }
})

// Minimal server-side sanitizer to keep bodyHtml a safe fragment
function sanitizeBodyHtml(input: string, title?: string) {
  const stripFence = (t: string) => {
    const m = t.match(/```[a-zA-Z]*\n([\s\S]*?)```/)
    return m && m[1] ? m[1].trim() : t.trim()
  }
  const extractBody = (t: string) => {
    const m = t.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
    return m && m[1] ? m[1].trim() : t
  }
  const dropBlocks = (t: string) =>
    t
      .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
      .replace(/<head[\s\S]*?<\/head>/gi, '')
      .replace(/<html[^>]*>/gi, '')
      .replace(/<\/html>/gi, '')
  const harden = (t: string) =>
    t
      .replace(/<a\s+([^>]*href=\s*\"[^\"]+\"[^>]*)>/gi, (m, attrs) => {
        const hasRel = /\brel\s*=\s*/i.test(attrs)
        return `<a ${attrs}${hasRel ? '' : ' rel=\\"noopener noreferrer\\"'}>`
      })
      .replace(/\son[a-z]+\s*=\s*\"[^\"]*\"/gi, '')
      .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
      .replace(/\sstyle\s*=\s*\"[^\"]*\"/gi, '')
      .replace(/\sstyle\s*=\s*'[^']*'/gi, '')
  const ensureArticle = (t: string) => {
    const s = t.trim()
    if (/^<article[\s>]/i.test(s)) return s
    if (!/<[a-z][\s\S]*>/i.test(s)) {
      return `<article>${title ? `<h1>${escapeHtml(title)}</h1>` : ''}<p>${escapeHtml(s)}</p></article>`
    }
    return `<article>${s}</article>`
  }
  const escapeHtml = (x: string) => String(x || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  let s = stripFence(String(input || ''))
  s = extractBody(s)
  s = dropBlocks(s)
  s = harden(s)
  s = s.trim()
  if (!s) return `<article>${title ? `<h1>${escapeHtml(title)}</h1>` : ''}<p>Draft content pending.</p></article>`
  return ensureArticle(s)
}
