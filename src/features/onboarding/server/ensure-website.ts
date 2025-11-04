import { hasDatabase, getDb } from '@common/infra/db'
import { queueEnabled, publishJob } from '@common/infra/queue'
import { recordJobQueued } from '@common/infra/jobs'
import { websitesRepo } from '@entities/website/repository'
import { orgs } from '@entities/org/db/schema'
import { websites } from '@entities/website/db/schema'
import { eq } from 'drizzle-orm'
import { normalizeSiteInput } from '../shared/url'
import { log } from '@src/common/logger'

export type EnsureWebsiteResult = {
  website: { id: string; orgId: string; url: string }
  existed: boolean
  crawlJobId?: string | null
}

export async function ensureWebsiteForOrg(orgId: string, siteUrlInput: string, options?: { websiteName?: string }) {
  // Ensure FK target exists after fresh DB resets
  await ensureOrgExists(orgId)
  const normalized = normalizeSiteInput(siteUrlInput)
  const existing = await findWebsiteByUrl(orgId, normalized.siteUrl)
  if (existing) {
    return { website: existing, existed: true, crawlJobId: null }
  }
  const website = await websitesRepo.create({ orgId, url: normalized.siteUrl, defaultLocale: 'en-US' })
  let crawlJobId: string | null = null
  try {
    const masked = process.env.RABBITMQ_URL
      ? (() => { try { const u = new URL(process.env.RABBITMQ_URL); return `amqp://${u.username || 'user'}:****@${u.hostname}${u.port ? ':'+u.port : ''}${u.pathname || '/'}` } catch { return 'amqp://<invalid>' } })()
      : 'amqp://<missing>'
    log.info('[onboarding] enqueue crawl', { websiteId: website.id, queueEnabled: queueEnabled(), rabbit: masked })
    if (queueEnabled()) {
      crawlJobId = await publishJob({ type: 'crawl', payload: { websiteId: website.id } })
      recordJobQueued(website.id, 'crawl', crawlJobId)
      log.info('[onboarding] crawl queued', { websiteId: website.id, jobId: crawlJobId })
    }
  } catch (error) {
    log.error('[onboarding] failed to enqueue crawl', { websiteId: website.id, error: (error as Error)?.message || String(error) })
  }
  return { website, existed: false, crawlJobId }
}

async function findWebsiteByUrl(orgId: string, siteUrl: string): Promise<{ id: string; orgId: string; url: string } | null> {
  if (!hasDatabase()) return null
  try {
    const db = getDb()
    const rows = await db.select().from(websites).where(eq(websites.orgId, orgId)).limit(200)
    const normalized = normalizeSiteInput(siteUrl).siteUrl
    const match = rows.find((row: any) => {
      if (typeof row.url !== 'string' || !row.url) return false
      try { return normalizeSiteInput(row.url).siteUrl === normalized } catch { return false }
    })
    if (!match) return null
    return { id: match.id, orgId: match.orgId, url: match.url }
  } catch (error) {
    log.error('[onboarding] findWebsiteByUrl failed', { orgId, siteUrl, error: (error as Error)?.message || String(error) })
    return null
  }
}

async function ensureOrgExists(orgId: string) {
  if (!hasDatabase()) return
  try {
    const db = getDb()
    const rows = await db.select().from(orgs).where(eq(orgs.id as any, orgId)).limit(1) as any
    if (rows && rows[0]) return
    const name = `${orgId.split('_')[0] || 'org'}'s Org`
    await db.insert(orgs).values({ id: orgId, name, plan: 'starter', entitlementsJson: null as any }).onConflictDoNothing?.()
    log.info('[onboarding] created missing org', { orgId })
  } catch (error) {
    log.error('[onboarding] ensureOrgExists failed', { orgId, error: (error as Error)?.message || String(error) })
  }
}
