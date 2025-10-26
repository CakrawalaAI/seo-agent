import { createFileRoute } from '@tanstack/react-router'
import { getSession } from '@seo-agent/auth'
import { AcceptOrgInviteInputSchema } from '@seo-agent/domain'
import { acceptOrgInvite } from '~/server/services/orgs'
import { httpError, json, safeHandler } from '../../../../utils'

const parseBody = async (request: Request) => {
  try {
    return await request.json()
  } catch (error) {
    return {}
  }
}

const applyAuthHeaders = (response: Response, headers?: Headers) => {
  if (!headers) return response
  headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') {
      response.headers.append(key, value)
    } else {
      response.headers.set(key, value)
    }
  })
  return response
}

export const Route = createFileRoute('/api/orgs/invites/$token/accept')({
  server: {
    handlers: {
      POST: safeHandler(async ({ params, request }) => {
        const { session, headers } = await getSession(request)
        const rawBody = await parseBody(request)
        const basePayload =
          typeof rawBody === 'object' && rawBody !== null ? rawBody : {}
        const parsed = AcceptOrgInviteInputSchema.safeParse({
          ...basePayload,
          token: params.token
        })

        if (!parsed.success) {
          return httpError(400, 'Invalid invite token', parsed.error.flatten())
        }

        const sessionUserId =
          session && typeof session === 'object' && 'user' in session
            ? String((session as any).user?.id ?? '')
            : ''
        const userId = parsed.data.userId ?? sessionUserId
        if (!userId) {
          return httpError(401, 'Not authenticated')
        }

        const result = await acceptOrgInvite({ token: parsed.data.token, userId })
        const response = json(result, { status: result.status === 'accepted' ? 200 : 202 })
        return applyAuthHeaders(response, headers)
      })
    }
  }
})
