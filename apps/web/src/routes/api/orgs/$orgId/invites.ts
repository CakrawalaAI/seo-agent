import { createFileRoute } from '@tanstack/react-router'
import { getSession } from '@seo-agent/auth'
import { CreateOrgInviteInputSchema } from '@seo-agent/domain'
import { createOrgInvite } from '~/server/services/orgs'
import { httpError, json, safeHandler } from '../../../utils'

const mergePayload = async (request: Request, orgId: string) => {
  let body: unknown = {}
  try {
    body = await request.json()
  } catch (error) {
    body = {}
  }
  const parsed = CreateOrgInviteInputSchema.safeParse({
    ...(typeof body === 'object' && body !== null ? body : {}),
    orgId
  })
  if (!parsed.success) {
    throw httpError(400, 'Invalid invite payload', parsed.error.flatten())
  }
  return parsed.data
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

export const Route = createFileRoute('/api/orgs/$orgId/invites')({
  server: {
    handlers: {
      POST: safeHandler(async ({ params, request }) => {
        const { session, headers } = await getSession(request)
        const userId =
          session && typeof session === 'object' && 'user' in session
            ? String((session as any).user?.id ?? '')
            : ''
        if (!userId) {
          return httpError(401, 'Not authenticated')
        }

        const payload = await mergePayload(request, params.orgId)
        const result = await createOrgInvite(payload, { invitedByUserId: userId })
        const response = json(result, { status: 201 })
        return applyAuthHeaders(response, headers)
      })
    }
  }
})
