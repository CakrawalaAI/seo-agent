export type JsonFetchOptions = RequestInit & {
  /**
   * When true, bypasses JSON detection and returns the raw Response.
   * Useful for callers that need headers or custom parsing.
   */
  raw?: boolean
}

export async function fetchJson<T = unknown>(input: RequestInfo | URL, init: JsonFetchOptions = {}) {
  const response = await fetch(input, {
    credentials: 'include',
    ...init
  })

  if (!response.ok) {
    throw new Error(await readErrorBody(response))
  }

  if (init.raw) {
    return response as unknown as T
  }

  if (response.status === 204) {
    return null as T
  }

  const contentType =
    typeof response.headers?.get === 'function' ? response.headers.get('content-type') ?? '' : ''
  if (contentType.includes('application/json') || typeof response.json === 'function') {
    return (await response.json()) as T
  }

  if (typeof response.text === 'function') {
    return (await response.text()) as unknown as T
  }

  return undefined as unknown as T
}

export const postJson = <T = unknown>(path: string, body: unknown, init: RequestInit = {}) =>
  fetchJson<T>(path, jsonInit('POST', body, init))

export const putJson = <T = unknown>(path: string, body: unknown, init: RequestInit = {}) =>
  fetchJson<T>(path, jsonInit('PUT', body, init))

export const patchJson = <T = unknown>(path: string, body: unknown, init: RequestInit = {}) =>
  fetchJson<T>(path, jsonInit('PATCH', body, init))

export const deleteJson = <T = unknown>(path: string, body?: unknown, init: RequestInit = {}) =>
  fetchJson<T>(path, jsonInit('DELETE', body, init))

export function extractErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message || 'Request failed'
  }
  if (typeof error === 'string') {
    return error
  }
  try {
    return JSON.stringify(error)
  } catch {
    return 'Unknown error'
  }
}

async function readErrorBody(response: Response) {
  try {
    const cloned = typeof response.clone === 'function' ? response.clone() : response
    if (typeof cloned.json === 'function') {
      const parsed = await cloned.json().catch(() => null)
      if (parsed) {
        if (typeof parsed?.message === 'string') {
          return parsed.message
        }
        if (typeof parsed?.error === 'string') {
          return parsed.error
        }
        return JSON.stringify(parsed)
      }
    }
    if (typeof cloned.text === 'function') {
      const text = await cloned.text()
      if (text) {
        return text
      }
    }
  } catch {
    // ignore parsing errors and fall back to status text
  }
  return `Request failed with ${response.status}`
}

function jsonInit(method: string, body: unknown, init: RequestInit): RequestInit {
  return {
    method,
    headers: {
      'content-type': 'application/json',
      ...(init.headers ?? {})
    },
    body: body === undefined ? undefined : JSON.stringify(body ?? {}),
    ...init
  }
}
