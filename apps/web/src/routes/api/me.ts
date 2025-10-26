// @ts-nocheck
import { getSession } from '@seo-agent/auth'
import type { MeResponse } from '@seo-agent/domain'
import { createFileRoute } from '@tanstack/react-router'
import { json, safeHandler } from './utils'
import { getOrgContextForUser } from '~/server/services/orgs'

const applyAuthHeaders = (response: Response, headers?: Headers) => {
  if (!headers) {
    return response
  }
  headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') {
      response.headers.append(key, value)
    } else {
      response.headers.set(key, value)
    }
  })
  return response
}

const normalizeUser = (session: unknown) => {
  if (!session || typeof session !== 'object' || !('user' in session)) {
    return null
  }

  const user = (session as { user: Record<string, unknown> }).user
  const createdAt = typeof user.createdAt === 'string' ? user.createdAt : new Date().toISOString()
  const updatedAt = typeof user.updatedAt === 'string' ? user.updatedAt : createdAt
  const name = typeof user.name === 'string' && user.name.length > 0 ? user.name : user.email

  return {
    id: String(user.id ?? ''),
    email: String(user.email ?? ''),
    name: typeof name === 'string' ? name : '',
    imageUrl: typeof user.image === 'string' ? user.image : undefined,
    emailVerified: Boolean(user.emailVerified ?? false),
    createdAt,
    updatedAt
  }
}

export const Route = createFileRoute('/api/me')({
  server: {
    handlers: {
      GET: safeHandler(async ({ request }) => {
        const { session, headers } = await getSession(request)
        const user = normalizeUser(session)
        const preferredOrgId =
          request.headers.get('x-org-id') ?? request.headers.get('x-org') ?? undefined

        let orgs: MeResponse['orgs'] = []
        let activeOrg: MeResponse['activeOrg'] = null
        let entitlements: MeResponse['entitlements'] = null

        if (user) {
          const userId = user.id
          const context = await getOrgContextForUser(userId, {
            requestedOrgId: preferredOrgId ?? undefined
          })
          orgs = context.orgs
          activeOrg = context.activeOrg
          entitlements = context.entitlements
        }

        const payload: MeResponse = {
          user,
          orgs,
          activeOrg,
          entitlements
        }
        const response = json(payload)
        return applyAuthHeaders(response, headers)
      })
    }
  }
})
