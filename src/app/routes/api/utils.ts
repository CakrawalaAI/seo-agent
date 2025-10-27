export const json = (data: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(data), {
    headers: {
      'content-type': 'application/json; charset=utf-8'
    },
    ...init
  })

export const httpError = (status: number, message: string, details?: unknown) =>
  new Response(JSON.stringify({ message, code: String(status), details }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  })

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
      if (error instanceof Response) return error
      console.error('API error', error)
      return httpError(500, 'Internal Server Error')
    }
  }
}

