// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession } from '@app/api-utils'
import { projectsRepo } from '@entities/project/repository'
import { hasDatabase, getDb } from '@common/infra/db'
import { projects } from '@entities/project/db/schema'
import { orgs } from '@entities/org/db/schema'
import { queueEnabled, publishJob } from '@common/infra/queue'
import { recordJobQueued } from '@common/infra/jobs'
import { crawlRepo } from '@entities/crawl/repository'
import { desc } from 'drizzle-orm'

export const Route = createFileRoute('/api/projects')({
  server: {
    handlers: {
      GET: safeHandler(async ({ request }) => {
        const url = new URL(request.url)
        const limit = Number(url.searchParams.get('limit') || '50')
        const orgId = url.searchParams.get('orgId') || undefined
        if (hasDatabase()) {
          try {
            const db = getDb()
            // @ts-ignore
            const rows = await (orgId
              ? (db.select().from(projects).where((projects as any).orgId.eq(orgId)).orderBy(desc(projects.createdAt)).limit(Number.isFinite(limit) ? limit : 50) as any)
              : (db.select().from(projects).orderBy(desc(projects.createdAt)).limit(Number.isFinite(limit) ? limit : 50) as any))
            return json({ items: rows })
          } catch {}
        }
        const items = projectsRepo.list({ orgId: orgId || undefined, limit: Number.isFinite(limit) ? limit : 50 })
        return json({ items })
      }),
      POST: safeHandler(async ({ request }) => {
        await requireSession(request)
        const body = await request.json().catch(() => ({}))
        if (!body?.orgId || !body?.name || !body?.siteUrl || !body?.defaultLocale) {
          return httpError(400, 'Missing required fields')
        }
        // No project quota — unlimited projects per new seat model
        const project = projectsRepo.create({
          orgId: String(body.orgId),
          name: String(body.name),
          siteUrl: String(body.siteUrl),
          defaultLocale: String(body.defaultLocale)
        })
        // best-effort persist to DB if configured
        if (hasDatabase()) {
          try {
            const db = getDb()
            await db.insert(projects).values({
              id: project.id,
              name: project.name,
              defaultLocale: project.defaultLocale,
              orgId: project.orgId ?? null,
              siteUrl: project.siteUrl ?? null,
              autoPublishPolicy: project.autoPublishPolicy ?? null,
              status: project.status ?? 'draft'
            }).onConflictDoNothing()
          } catch (err) {
            console.warn('[projects] DB insert skipped:', (err as Error)?.message ?? String(err))
          }
        }
        // auto-start crawl job per spec
        let crawlJobId: string | null = null
        try {
          const masked = process.env.RABBITMQ_URL ? (() => { try { const u = new URL(process.env.RABBITMQ_URL); return `amqp://${u.username || 'user'}:****@${u.hostname}${u.port ? ':'+u.port : ''}${u.pathname || '/'}` } catch { return 'amqp://<invalid>' } })() : 'amqp://<missing>'
          console.info('[api/projects] create: enqueue crawl', { projectId: project.id, queueEnabled: queueEnabled(), rabbit: masked })
          if (queueEnabled()) {
            crawlJobId = await publishJob({ type: 'crawl', payload: { projectId: project.id } })
            recordJobQueued(project.id, 'crawl', crawlJobId)
            console.info('[api/projects] crawl queued', { projectId: project.id, jobId: crawlJobId })
          } else {
            const seeded = crawlRepo.seedRun(project.id)
            crawlJobId = seeded.jobId
            console.warn('[api/projects] queue disabled; seeded local crawl pages', { projectId: project.id, jobId: crawlJobId })
          }
        } catch (err) {
          console.error('[api/projects] failed to enqueue crawl', { projectId: project.id, error: (err as Error)?.message || String(err) })
        }
        return json({ project, crawlJobId }, { status: 201 })
      })
    }
  }
})
