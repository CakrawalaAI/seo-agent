import { ZodSchema, ZodTypeAny } from 'zod'

export async function parseJson<T>(request: Request, schema: ZodSchema<T> | ZodTypeAny): Promise<T> {
  const body = await request.json().catch(() => ({}))
  const res = schema.safeParse(body)
  if (!res.success) {
    const err = res.error?.issues?.[0]
    const msg = err ? `${err.path.join('.') || 'body'}: ${err.message}` : 'Invalid JSON body'
    const details = { issues: res.error?.issues?.slice(0, 5) }
    throw new Response(JSON.stringify({ message: msg, code: '400', details }), {
      status: 400,
      headers: { 'content-type': 'application/json; charset=utf-8' }
    })
  }
  return res.data as T
}
