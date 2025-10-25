// @ts-nocheck
import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { listArticles } from '~/server/services/articles'
import { httpError, json, safeHandler } from './utils'

const ArticleQuerySchema = z.object({
  projectId: z.string().min(1),
  status: z.enum(['draft', 'published', 'failed']).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().optional()
})

export const Route = createFileRoute('/api/articles')({
  server: {
    handlers: {
      GET: safeHandler(async ({ request }) => {
        const url = new URL(request.url)
        const parsed = ArticleQuerySchema.safeParse(Object.fromEntries(url.searchParams))
        if (!parsed.success) {
          return httpError(400, 'Invalid query params', parsed.error.flatten())
        }

        const { projectId, status, cursor, limit } = parsed.data
        const response = await listArticles(projectId, { status, cursor, limit })
        return json(response)
      })
    }
  }
})
