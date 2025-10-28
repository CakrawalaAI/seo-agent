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

// Auth helpers (cookie-based session)
import { session } from '@common/infra/session'
import { hasDatabase, getDb } from '@common/infra/db'
import { projects } from '@entities/project/db/schema'
import { orgMembers } from '@entities/org/db/schema'
import { projectsRepo } from '@entities/project/repository'
import { eq } from 'drizzle-orm'

export function requireSession(request: Request) {
  if (process.env.E2E_NO_AUTH === '1') {
    // bypass in e2e/dev if explicitly allowed
    return { user: { email: 'e2e@example.com' }, activeOrg: { id: 'org-dev' } }
  }
  const sess = session.read(request)
  if (!sess || !sess.user) {
    throw httpError(401, 'Unauthorized')
  }
  return sess
}

export function requireActiveOrg(request: Request) {
  const sess = requireSession(request)
  if (!sess.activeOrg?.id) throw httpError(403, 'Organization not selected')
  return sess.activeOrg.id
}

export async function requireProjectAccess(request: Request, projectId: string) {
  const sess = requireSession(request)
  const activeOrgId = sess.activeOrg?.id
  if (!activeOrgId) throw httpError(403, 'Organization not selected')
  let projectOrg: string | null = null
  if (hasDatabase()) {
    try {
      const db = getDb()
      // @ts-ignore
      const rows = await (db.select().from(projects).where(eq(projects.id, projectId)).limit(1) as any)
      if (rows[0]) projectOrg = rows[0].orgId ?? null
    } catch {}
  }
  if (!projectOrg) {
    const proj = projectsRepo.get(projectId)
    projectOrg = proj?.orgId ?? null
  }
  if (projectOrg && projectOrg !== activeOrgId) throw httpError(403, 'Forbidden')
  // membership check if DB has org_members
  if (hasDatabase() && sess.user?.email && activeOrgId) {
    try {
      const db = getDb()
      // @ts-ignore
      const rows = await (db.select().from(orgMembers).where((orgMembers as any).orgId.eq(activeOrgId)).limit(1) as any)
      if (Array.isArray(rows) && rows.length === 0) {
        // if no org_members at all, skip enforcement
      } else {
        // @ts-ignore
        const r2 = await (db.select().from(orgMembers).where((orgMembers as any).orgId.eq(activeOrgId)).where((orgMembers as any).userEmail.eq(sess.user.email)).limit(1) as any)
        if (!r2?.[0]) throw httpError(403, 'Forbidden')
      }
    } catch {}
  }
  return true
}
