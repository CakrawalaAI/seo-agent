import type { ApiError } from '@seo-agent/domain'
import { z } from 'zod'

export const json = (data: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(data), {
    headers: {
      'content-type': 'application/json; charset=utf-8'
    },
    ...init
  })

export const parseJson = async <T>(request: Request, schema: z.ZodSchema<T>): Promise<T> => {
  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw httpError(400, 'Invalid request payload', parsed.error.flatten())
  }
  return parsed.data
}

export const httpError = (status: number, message: string, details?: unknown) => {
  const error: ApiError = { message, code: String(status), details }
  return new Response(JSON.stringify(error), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  })
}

type HandlerContext = {
  request: Request
  params: Record<string, string>
  context: unknown
}

export const safeHandler = (
  handler: (ctx: HandlerContext) => Promise<Response> | Response
) => {
  return async (ctx: HandlerContext) => {
    try {
      return await handler(ctx)
    } catch (error) {
      if (error instanceof Response) {
        return error
      }
      if (error && typeof error === 'object') {
        const status = Number((error as any).status)
        if (Number.isFinite(status) && status >= 400) {
          const message =
            typeof (error as any).message === 'string'
              ? (error as any).message
              : 'Request failed'
          const code = typeof (error as any).code === 'string' ? (error as any).code : undefined
          const details = (error as any).details ?? (code ? { code } : undefined)
          if (status >= 500) {
            console.error('API error', error)
          } else {
            console.warn('API request error', error)
          }
          return httpError(status, message, details)
        }
      }
      console.error('API error', error)
      return httpError(500, 'Internal Server Error')
    }
  }
}
