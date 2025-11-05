import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession, requireWebsiteAccess } from '@app/api-utils'
import { z } from 'zod'
import { parseJson } from '@common/http/validate'
import { articlesRepo } from '@entities/article/repository'
import { issueUploadUrl, issueDownloadUrl, deleteAttachment } from '@features/articles/server/media-service'
import { attachmentsRepo } from '@entities/article/repository.attachments'
import { buildPublicUrl } from '@common/infra/s3'

const requestSchema = z
  .object({
    action: z.enum(['upload', 'download', 'delete', 'complete']),
    filename: z.string().trim().min(1).max(140).optional(),
    contentType: z.string().trim().max(160).optional(),
    contentLength: z.number().int().positive().optional(),
    storageKey: z.string().trim().optional(),
    attachmentId: z.string().trim().optional(),
    type: z.enum(['image', 'youtube', 'file']).optional(),
    url: z.string().trim().url().optional(),
    caption: z.string().trim().max(240).optional()
  })
  .superRefine((data, ctx) => {
    switch (data.action) {
      case 'upload':
        if (!data.filename) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'filename required', path: ['filename'] })
        break
      case 'download':
      case 'delete':
        if (!data.storageKey && !data.attachmentId) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'storageKey or attachmentId required', path: ['storageKey'] })
        }
        break
      case 'complete':
        if (!data.storageKey) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'storageKey required', path: ['storageKey'] })
        if (!data.type) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'type required', path: ['type'] })
        break
    }
  })

export const Route = createFileRoute('/api/articles/$articleId/media')({
  server: {
    handlers: {
      POST: safeHandler(async ({ request, params }) => {
        await requireSession(request)
        const article = await articlesRepo.get(String(params.articleId))
        if (!article) return httpError(404, 'Article not found')
        const websiteId = String(article.websiteId || '')
        if (!websiteId) return httpError(400, 'Article missing website')
        await requireWebsiteAccess(request, websiteId)

        const body = await parseJson(request, requestSchema)
        try {
          if (body.action === 'upload') {
            const result = await issueUploadUrl({
              articleId: article.id,
              filename: body.filename!,
              contentType: body.contentType,
              contentLength: body.contentLength
            })
            return json({ kind: 'upload', ...result })
          }
          if (body.action === 'download') {
            const result = await issueDownloadUrl({
              articleId: article.id,
              attachmentId: body.attachmentId,
              storageKey: body.storageKey
            })
            return json({ kind: 'download', ...result })
          }
          if (body.action === 'complete') {
            const storageKey = body.storageKey!
            const url = body.url || buildPublicUrl(storageKey)
            const result = await attachmentsRepo.add(article.id, {
              type: body.type || 'image',
              url,
              caption: body.caption ?? null,
              storageKey
            })
            return json({ kind: 'complete', id: result.id, storageKey, url })
          }
          const result = await deleteAttachment({
            articleId: article.id,
            attachmentId: body.attachmentId,
            storageKey: body.storageKey
          })
          return json({ kind: 'delete', storageKey: result.storageKey })
        } catch (error) {
          const message = (error as Error)?.message || 'presign failed'
          if (/not configured/i.test(message)) return httpError(503, message)
          if (/invalid filename/i.test(message)) return httpError(400, message)
          if (/attachment missing storage key/i.test(message)) return httpError(400, message)
          return httpError(500, message)
        }
      })
    }
  }
})
