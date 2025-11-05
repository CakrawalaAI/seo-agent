import type { IncomingMessage } from 'node:http'

export function incomingMessageToRequest(req: IncomingMessage): Request {
  const host = req.headers.host ?? 'localhost'
  const forwardedProto = req.headers['x-forwarded-proto']
  let protocol = 'http'
  if (Array.isArray(forwardedProto)) {
    protocol = forwardedProto[0] ?? 'http'
  } else if (typeof forwardedProto === 'string') {
    protocol = forwardedProto
  }
  const segments = String(protocol).split(',')
  const normalized = segments.length > 0 ? segments[0]!.trim() : ''
  protocol = normalized || 'http'
  const url = new URL(req.url || '/', `${protocol}://${host}`)
  const headers = new Headers()

  for (const [key, value] of Object.entries(req.headers)) {
    if (!value) continue
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v)
    } else {
      headers.set(key, value)
    }
  }

  return new Request(url.toString(), {
    method: req.method || 'GET',
    headers
  })
}
