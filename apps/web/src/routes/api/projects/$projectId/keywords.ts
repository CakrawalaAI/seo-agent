// @ts-nocheck
import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { KeywordStatusSchema } from '@seo-agent/domain'
import { listKeywords } from '~/server/services/keywords'
import { httpError, json, safeHandler } from '../../utils'

const KeywordParamsSchema = z.object({
  projectId: z.string().min(1)
})

const KeywordQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().optional(),
  status: KeywordStatusSchema.optional()
})

export const Route = createFileRoute('/api/projects/$projectId/keywords')({
  server: {
    handlers: {
      GET: safeHandler(async ({ params, request }) => {
        const { projectId } = KeywordParamsSchema.parse(params)
        const url = new URL(request.url)
        const query = KeywordQuerySchema.safeParse(Object.fromEntries(url.searchParams))
        if (!query.success) {
          return httpError(400, 'Invalid keyword query', query.error.flatten())
        }

        const { cursor, limit, status } = query.data
        const response = await listKeywords(projectId, {
          cursor,
          limit,
          status: status ?? undefined
        })
        return json(response)
      })
    }
  }
})
